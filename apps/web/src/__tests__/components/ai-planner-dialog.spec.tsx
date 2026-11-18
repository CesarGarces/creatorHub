import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.setConfig({ testTimeout: 20_000 });

const voice = vi.hoisted(() => ({
  options: null as null | {
    language?: string;
    onPartialTranscript: (text: string, isFinal: boolean) => void;
  },
  toggleMic: vi.fn(async () => {}),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
// The real selector loads models from the API; here it picks "model-1".
vi.mock("@/components/provider-select", async () => {
  const { useEffect } = await import("react");
  return {
    ProviderSelect: ({
      value,
      label,
      onChange,
    }: {
      value: string;
      label?: string;
      onChange: (id: string, option: { displayName: string }) => void;
    }) => {
      useEffect(() => {
        if (!value) onChange("model-1", { displayName: "Model One" });
      }, [value, onChange]);
      return (
        <div data-testid="provider-select">
          {label}: {value}
        </div>
      );
    },
  };
});
vi.mock("@/components/voice-button", () => ({
  VoiceButton: ({ onToggle }: { onToggle: () => void }) => (
    <button type="button" onClick={onToggle}>
      Voice
    </button>
  ),
  useVoiceButton: (options: NonNullable<typeof voice.options>) => {
    voice.options = options;
    return {
      isListening: false,
      isSupported: true,
      toggleMic: voice.toggleMic,
    };
  },
}));
vi.mock("@/components/voice-button/use-voice-pricing", () => ({
  useSttCreditsPerSecond: () => 2,
}));
vi.mock("@/lib/content-planner/ai-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content-planner/ai-plan")>()),
  streamAiPlan: vi.fn(),
}));

import { toast } from "sonner";
import api from "@/lib/api";
import { AiPlannerDialog } from "@/components/content-planner/ai-planner-dialog";
import {
  streamAiPlan,
  type AiPlanResult,
  type PlanningEvent,
} from "@/lib/content-planner/ai-plan";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { useCreditsStore } from "@/store/credits.store";
import { useToolsStore } from "@/store/tools.store";

const apiMock = vi.mocked(api);
const streamMock = vi.mocked(streamAiPlan);
const createProject = vi.fn();
const fetchBalance = vi.fn();

const ESTIMATE = {
  modelId: "model-1",
  modelName: "Model One",
  modelCost: 3,
  embeddingModel: "Built-in",
  embeddingCost: 0,
  total: 3,
};

const PLAN: AiPlanResult = {
  title: "Sourdough for beginners",
  summary: "A friendly step-by-step bread video.",
  platform: "youtube-long",
  complexity: {
    level: "medium",
    score: 3,
    rationale: "Needs a long shoot and careful editing.",
  },
  signals: {
    inputWords: 40,
    sources: 1,
    excerpts: 2,
    similarProductions: 1,
    historyAverageMinutes: 300,
    mentionedTools: [],
    heuristicScore: 2,
  },
  steps: [
    {
      name: "Scripting",
      type: "SCRIPTING",
      durationMinutes: 60,
      description: "Outline the steps of the recipe.",
      isPublish: false,
      toolAction: {
        toolId: "script-writer",
        toolName: "Script Writer",
        intention: "Draft the voice-over script",
        prompt: "Write a 6 minute sourdough tutorial script",
      },
    },
    {
      name: "Dough timelapse",
      type: "RECORDING",
      durationMinutes: 120,
      description: "Film the dough rising.",
      isPublish: false,
      toolAction: null,
    },
    {
      name: "Publishing",
      type: "PUBLISHING",
      durationMinutes: 30,
      description: "",
      isPublish: true,
      toolAction: null,
    },
  ],
  totalMinutes: 210,
  suggestedPublishInDays: 3,
  historyEstimateMinutes: 300,
  similarProductions: [
    {
      projectId: "old-1",
      title: "Pizza at home",
      similarity: 0.82,
      totalMinutes: 300,
      sessions: 4,
    },
  ],
  sources: [{ name: "brief.md", kind: "md", chars: 300, truncated: false }],
  model: { id: "model-1", name: "Model One" },
  embeddingModel: "local:hash-v1",
};

beforeEach(() => {
  vi.clearAllMocks();
  voice.options = null;
  useContentPlannerStore.setState(
    useContentPlannerStore.getInitialState(),
    true,
  );
  useContentPlannerStore.setState({ createProject, customPlatforms: [] });
  useCreditsStore.setState({ balance: 50, fetchBalance });
  useToolsStore.setState({ tools: [], fetchTools: vi.fn(async () => {}) });
  createProject.mockResolvedValue({ projectId: "p1", conflicts: [] });
  apiMock.get.mockImplementation(async (path: string) =>
    path.endsWith("/ai-plans/estimate") ? { data: ESTIMATE } : { data: [] },
  );
});

function renderDialog() {
  const props = { onClose: vi.fn(), onPlanned: vi.fn(), onReview: vi.fn() };
  render(<AiPlannerDialog open {...props} />);
  return props;
}

const ideaBox = () => screen.getByLabelText("Your idea");
const typeIdea = (text = "A beginner video about baking sourdough bread") =>
  fireEvent.change(ideaBox(), { target: { value: text } });
const analyzeButton = () =>
  screen.getByRole("button", { name: "Analyze with AI" });
const fileInput = () => screen.getByTestId("plan-files") as HTMLInputElement;
const addFiles = (...files: File[]) =>
  fireEvent.change(fileInput(), { target: { files } });

/** streamAiPlan that reports the stages and returns PLAN. */
function resolveWithPlan(plan = PLAN, creditsCharged = 3) {
  streamMock.mockImplementation(async (_req, onEvent) => {
    for (const stage of ["reading", "retrieving", "analyzing"] as const) {
      onEvent({ type: "stage", stage });
    }
    const done = { type: "done", planId: "plan-1", plan, creditsCharged };
    onEvent(done as PlanningEvent);
    return done as Extract<PlanningEvent, { type: "done" }>;
  });
}

async function runToResult() {
  resolveWithPlan();
  const props = renderDialog();
  typeIdea();
  fireEvent.change(screen.getByLabelText("Publish date (optional)"), {
    target: { value: "2030-03-08" }, // Friday
  });
  await waitFor(() =>
    expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(analyzeButton());
  await screen.findByTestId("plan-result");
  return props;
}

// ─── Form ───────────────────────────────────────────────────────────

describe("AI planner · form", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <AiPlannerDialog
        open={false}
        onClose={vi.fn()}
        onPlanned={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("uses the platform's text-model selector and shows the cost of a run", async () => {
    renderDialog();
    expect(
      screen.getByRole("dialog", { name: "AI planning assistant" }),
    ).toBeTruthy();
    expect(screen.getByTestId("provider-select").textContent).toBe(
      "AI model: model-1",
    );
    const cost = await screen.findByTestId("plan-cost");
    expect(apiMock.get).toHaveBeenCalledWith(
      "/tools/content-planner/ai-plans/estimate",
      { params: { model: "model-1" } },
    );
    expect(cost.textContent).toContain("This analysis costs 3 credits");
    expect(cost.textContent).toContain(
      "Model One: 3 · Knowledge search: 0 · Your balance: 50 credits",
    );
    expect(screen.getByText("Voice input: 2 credits per second")).toBeTruthy();
  });

  it("blocks the analysis when the balance is too low", async () => {
    useCreditsStore.setState({ balance: 2 });
    renderDialog();
    await screen.findByText("You don't have enough credits for this analysis.");
    expect((analyzeButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks for an idea, a dictation or a file first", async () => {
    renderDialog();
    await screen.findByTestId("plan-cost");
    typeIdea("short");
    fireEvent.click(analyzeButton());
    expect(screen.getByRole("alert").textContent).toBe(
      "Describe your idea, dictate it or attach a file",
    );
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("appends dictated text to the idea (in the interface language)", async () => {
    renderDialog();
    await screen.findByTestId("plan-cost");
    typeIdea("My idea:");
    fireEvent.click(screen.getByRole("button", { name: "Voice" }));
    expect(voice.toggleMic).toHaveBeenCalledTimes(1);
    expect(voice.options?.language).toBe("en");

    act(() => voice.options!.onPartialTranscript("bread for", false));
    expect((ideaBox() as HTMLTextAreaElement).value).toBe("My idea: bread for");
    act(() => voice.options!.onPartialTranscript("bread for kids", true));
    act(() => voice.options!.onPartialTranscript("at home", true));
    expect((ideaBox() as HTMLTextAreaElement).value).toBe(
      "My idea: bread for kids at home",
    );
  });

  it("attaches supported files and explains the rejected ones", async () => {
    renderDialog();
    await screen.findByTestId("plan-cost");
    expect(fileInput().accept).toBe(".pdf,.docx,.txt,.json,.md");
    addFiles(
      new File(["# brief"], "brief.md"),
      new File(["x"], "photo.png"),
      new File(["{}"], "notes.json"),
    );
    expect(screen.getByText("brief.md")).toBeTruthy();
    expect(screen.getByText("notes.json")).toBeTruthy();
    expect(screen.queryByText("photo.png")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      "“photo.png” isn't a supported file type",
    );

    addFiles(new File(["again"], "brief.md"));
    expect(screen.getByRole("alert").textContent).toBe(
      "“brief.md” is already attached",
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove brief.md" }));
    expect(screen.queryByText("brief.md")).toBeNull();
    expect(screen.getByText("notes.json")).toBeTruthy();
  });

  it("drag and drop adds files too", async () => {
    renderDialog();
    await screen.findByTestId("plan-cost");
    const zone = screen.getByText(
      "Drop files here or click to browse",
    ).parentElement!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["text"], "script.txt")] },
    });
    expect(screen.getByText("script.txt")).toBeTruthy();
  });
});

// ─── Running ────────────────────────────────────────────────────────

describe("AI planner · analysis", () => {
  it("sends the idea, files, platform, date and language", async () => {
    resolveWithPlan();
    renderDialog();
    typeIdea();
    const brief = new File(["# brief"], "brief.md");
    addFiles(brief);
    fireEvent.change(screen.getByLabelText("Publish date (optional)"), {
      target: { value: "2030-03-08" },
    });
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    await screen.findByTestId("plan-result");

    const [request, , signal] = streamMock.mock.calls[0]!;
    expect(request).toEqual({
      model: "model-1",
      idea: "A beginner video about baking sourdough bread",
      transcript: "",
      platform: "youtube-long",
      publishDate: new Date(2030, 2, 8, 18, 0).toISOString(),
      language: "en",
      files: [brief],
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(fetchBalance).toHaveBeenCalled();
  });

  it("a file alone is enough input", async () => {
    resolveWithPlan();
    renderDialog();
    addFiles(new File(["# brief"], "brief.md"));
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    await screen.findByTestId("plan-result");
    expect(streamMock.mock.calls[0]![0].idea).toBe("");
  });

  it("shows each stage while it runs, and cancel stops it", async () => {
    let report: (event: PlanningEvent) => void = () => {};
    let signal: AbortSignal | undefined;
    streamMock.mockImplementation((_req, onEvent, s) => {
      report = onEvent;
      signal = s;
      return new Promise((_resolve, reject) =>
        s?.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    });
    renderDialog();
    typeIdea();
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());

    const progress = await screen.findByTestId("plan-progress");
    act(() => report({ type: "stage", stage: "retrieving" }));
    const items = within(progress).getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-status"))).toEqual([
      "done",
      "done",
      "active",
      "todo",
      "todo",
    ]);
    expect(items[3]!.textContent).toBe("Analyzing with Model One");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(ideaBox()).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("goes back to the form with a translated error", async () => {
    streamMock.mockRejectedValue(
      new Error("Insufficient credits. This plan requires 3 credits."),
    );
    renderDialog();
    typeIdea();
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "You don't have enough credits for this action",
    );
    expect((ideaBox() as HTMLTextAreaElement).value).toContain("sourdough");
  });

  it("an invalid model answer has its own message", async () => {
    streamMock.mockRejectedValue(
      new Error(
        "The model didn't return a valid plan. Try again or choose another model.",
      ),
    );
    renderDialog();
    typeIdea();
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The model didn't return a valid plan. Try again or choose another model.",
    );
  });
});

// ─── Result ─────────────────────────────────────────────────────────

describe("AI planner · result", () => {
  it("shows complexity, history, steps with suggested tools and the cost", async () => {
    await runToResult();
    const result = screen.getByTestId("plan-result");
    expect(within(result).getByText("Sourdough for beginners")).toBeTruthy();
    expect(result.textContent).toContain("Medium complexity · 3/5");
    expect(result.textContent).toContain("Total plan: 3h 30m");
    expect(result.textContent).toContain("3 sessions");
    expect(result.textContent).toContain("≈ 3 working days");
    expect(result.textContent).toContain("3 credits used");
    expect(result.textContent).toContain(
      "Your similar videos took 5h on average",
    );
    expect(result.textContent).toContain("Pizza at home");
    expect(result.textContent).toContain("82% similar");
    expect(result.textContent).toContain("Read from: brief.md");

    const tools = within(result).getAllByTestId("tool-action");
    expect(tools).toHaveLength(1);
    expect(tools[0]!.textContent).toContain("Script Writer");
    expect(tools[0]!.textContent).toContain(
      "Intention: Draft the voice-over script",
    );
    expect(
      within(tools[0]!)
        .getByRole("link", { name: "Open Script Writer" })
        .getAttribute("href"),
    ).toBe(
      "/tools/script-writer?prompt=Write%20a%206%20minute%20sourdough%20tutorial%20script",
    );
  });

  it("uses the catalogue name of a known tool", async () => {
    useToolsStore.setState({
      tools: [
        {
          id: "script-writer",
          name: "Scripts Pro",
          description: "",
        } as never,
      ],
    });
    await runToResult();
    expect(screen.getByRole("link", { name: "Open Scripts Pro" })).toBeTruthy();
  });

  it("adds the plan to the calendar with tool actions and the plan id", async () => {
    const props = await runToResult();
    fireEvent.click(screen.getByRole("button", { name: "Add to calendar" }));
    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));

    const body = createProject.mock.calls[0]![0];
    expect(body).toMatchObject({
      title: "Sourdough for beginners",
      aiPlanId: "plan-1",
      platform: "youtube-long",
      publishAt: new Date(2030, 2, 8, 18, 0).toISOString(),
    });
    const events = body.events as Array<Record<string, unknown>>;
    expect(events.map((e) => e.type)).toEqual([
      "SCRIPTING",
      "RECORDING",
      "PUBLISHING",
    ]);
    expect(events[0]).toMatchObject({
      toolAction: {
        toolId: "script-writer",
        intention: "Draft the voice-over script",
        prompt: "Write a 6 minute sourdough tutorial script",
      },
      reminderMinutes: expect.any(Number),
    });
    expect(events[0]).not.toHaveProperty("customType");
    expect(events[1]).toMatchObject({
      customType: { name: "Dough timelapse" },
    });
    expect(events[1]).not.toHaveProperty("toolAction");
    // Sessions come before the publish time, publishing last.
    const starts = events.map((e) => Date.parse(String(e.startAt)));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(Date.parse(String(events[2]!.endAt))).toBeLessThanOrEqual(
      new Date(2030, 2, 8, 18, 30).getTime(),
    );

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onPlanned).toHaveBeenCalledWith(new Date(starts[0]!));
    expect(toast.success).toHaveBeenCalledWith(
      "“Sourdough for beginners” was added to your calendar",
    );
  });

  it("keeps the dialog open and explains when saving fails", async () => {
    createProject.mockRejectedValue(new Error("AI plan not found"));
    const props = await runToResult();
    fireEvent.click(screen.getByRole("button", { name: "Add to calendar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The item could not be found"),
    );
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("“Review and edit” hands the plan to Plan a video", async () => {
    const props = await runToResult();
    fireEvent.click(screen.getByRole("button", { name: "Review and edit" }));
    expect(createProject).not.toHaveBeenCalled();
    const initial = props.onReview.mock.calls[0]![0];
    expect(initial).toMatchObject({
      title: "Sourdough for beginners",
      platformValue: "youtube-long",
      publishDate: "2030-03-08",
      publishTime: "18:00",
      aiPlanId: "plan-1",
    });
    expect(initial.steps.map((s: { name: string | null }) => s.name)).toEqual([
      null,
      "Dough timelapse",
      null,
    ]);
    expect(initial.steps[0].toolAction.toolId).toBe("script-writer");
  });

  it("suggests a publish date when none was chosen", async () => {
    resolveWithPlan();
    renderDialog();
    typeIdea();
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    await screen.findByTestId("plan-result");
    fireEvent.click(screen.getByRole("button", { name: "Add to calendar" }));
    await waitFor(() => expect(createProject).toHaveBeenCalled());
    const publishAt = new Date(createProject.mock.calls[0]![0].publishAt);
    expect(publishAt.getTime()).toBeGreaterThan(Date.now());
    expect([publishAt.getHours(), publishAt.getMinutes()]).toEqual([18, 0]);
    expect([0, 6]).not.toContain(publishAt.getDay());
  });

  it("never schedules sessions in the past when the model's timeframe is too short", async () => {
    // 2 work sessions + publishing, but the model says 1 day.
    resolveWithPlan({
      ...PLAN,
      steps: [PLAN.steps[0]!, PLAN.steps[1]!, PLAN.steps[2]!],
      suggestedPublishInDays: 1,
    });
    renderDialog();
    typeIdea();
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    await screen.findByTestId("plan-result");
    expect(screen.queryByText(/Some sessions fall in the past/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add to calendar" }));
    await waitFor(() => expect(createProject).toHaveBeenCalled());
    const events = createProject.mock.calls[0]![0].events as Array<{
      startAt: string;
    }>;
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    for (const e of events) {
      expect(new Date(e.startAt).getTime()).toBeGreaterThanOrEqual(
        tomorrow.getTime(),
      );
    }
  });

  it("warns when the chosen publish date leaves sessions in the past", async () => {
    resolveWithPlan();
    renderDialog();
    typeIdea();
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    fireEvent.change(screen.getByLabelText("Publish date (optional)"), {
      target: { value: iso },
    });
    await waitFor(() =>
      expect((analyzeButton() as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyzeButton());
    await screen.findByTestId("plan-result");
    expect(screen.getByRole("status").textContent).toBe(
      "Some sessions fall in the past. Pick a later publish date or adjust them after creating the plan.",
    );
  });

  it("“Start over” returns to the form keeping the idea", async () => {
    await runToResult();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect((ideaBox() as HTMLTextAreaElement).value).toContain("sourdough");
  });
});
