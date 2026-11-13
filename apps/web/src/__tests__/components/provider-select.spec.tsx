import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));

import api from "@/lib/api";
import {
  ProviderSelect,
  mapModesToTaskTypes,
  type ModelOption,
} from "@/components/provider-select";
import { useCreditsStore } from "@/store/credits.store";

const get = vi.mocked(api.get);

function model(overrides: Partial<ModelOption>): ModelOption {
  return {
    id: overrides.modelId ?? "m",
    providerSlug: "openrouter",
    modelId: "m",
    displayName: "Model",
    taskType: "text-generation",
    tier: "free",
    creditCost: 1,
    isActive: true,
    supportsStreaming: true,
    supportsVision: false,
    description: null,
    tags: [],
    ...overrides,
  };
}

const FREE_MODEL = model({
  id: "1",
  modelId: "deepseek/v4",
  displayName: "DeepSeek V4",
  creditCost: 1,
});
const PRO_MODEL = model({
  id: "2",
  modelId: "anthropic/claude",
  displayName: "Claude",
  tier: "pro",
  creditCost: 5,
});

describe("mapModesToTaskTypes", () => {
  it("maps tool modes to unique task types and ignores unknown modes", () => {
    expect(mapModesToTaskTypes(["chat", "text", "translation"])).toEqual([
      "text-generation",
    ]);
    expect(mapModesToTaskTypes(["image", "video", "audio"])).toEqual([
      "image-generation",
      "video-generation",
    ]);
    expect(mapModesToTaskTypes([])).toEqual([]);
  });
});

describe("ProviderSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreditsStore.setState({ plan: "FREE" });
  });

  it("requests only models for the tool's task types", async () => {
    get.mockResolvedValue([]);
    render(
      <ProviderSelect
        toolModes={["image", "chat"]}
        value=""
        onChange={vi.fn()}
      />,
    );

    await screen.findByText("No models available for this tool.");
    expect(get).toHaveBeenCalledWith("/ai/models", {
      params: { taskTypes: "image-generation,text-generation" },
    });
  });

  it("does not query the API when the tool has no known modes", async () => {
    render(
      <ProviderSelect toolModes={["audio"]} value="" onChange={vi.fn()} />,
    );

    await screen.findByText("No models available for this tool.");
    expect(get).not.toHaveBeenCalled();
  });

  it("shows a loading state while models load", () => {
    get.mockReturnValue(new Promise(() => {}));
    render(<ProviderSelect toolModes={["chat"]} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Loading models...")).toBeTruthy();
  });

  it("auto-selects the first model when the current value is not available", async () => {
    get.mockResolvedValue([FREE_MODEL, PRO_MODEL]);
    const onChange = vi.fn();

    render(
      <ProviderSelect
        toolModes={["chat"]}
        value="removed/model"
        onChange={onChange}
      />,
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("deepseek/v4", FREE_MODEL),
    );
  });

  it("keeps a valid current selection", async () => {
    get.mockResolvedValue([FREE_MODEL, PRO_MODEL]);
    const onChange = vi.fn();

    render(
      <ProviderSelect
        toolModes={["chat"]}
        value="anthropic/claude"
        onChange={onChange}
      />,
    );

    await screen.findByText("Claude");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("5 cr")).toBeTruthy();
  });

  it("de-duplicates models by modelId, preferring the active entry", async () => {
    get.mockResolvedValue([
      model({
        id: "a",
        modelId: "dup",
        displayName: "Inactive copy",
        isActive: false,
      }),
      model({
        id: "b",
        modelId: "dup",
        displayName: "Active copy",
        isActive: true,
      }),
    ]);

    render(
      <ProviderSelect toolModes={["chat"]} value="dup" onChange={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole("button", { expanded: false }));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain("Active copy");
  });

  it("selects a model from the dropdown and closes it", async () => {
    get.mockResolvedValue([FREE_MODEL, PRO_MODEL]);
    useCreditsStore.setState({ plan: "PRO" });
    const onChange = vi.fn();

    render(
      <ProviderSelect
        toolModes={["chat"]}
        value="deepseek/v4"
        onChange={onChange}
        label="Chat model"
      />,
    );
    fireEvent.click(await screen.findByRole("button", { expanded: false }));
    expect(screen.getByRole("listbox", { name: "Chat model" })).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /Claude/ }));

    expect(onChange).toHaveBeenCalledWith("anthropic/claude", PRO_MODEL);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("prevents FREE users from choosing PRO models", async () => {
    get.mockResolvedValue([FREE_MODEL, PRO_MODEL]);
    const onChange = vi.fn();

    render(
      <ProviderSelect
        toolModes={["chat"]}
        value="deepseek/v4"
        onChange={onChange}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { expanded: false }));

    const pro = screen.getByRole("option", {
      name: /Claude/,
    }) as HTMLButtonElement;
    expect(pro.disabled).toBe(true);
    expect(pro.textContent).toContain("(upgrade)");
    fireEvent.click(pro);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes the dropdown on an outside click", async () => {
    get.mockResolvedValue([FREE_MODEL]);
    render(
      <div>
        <p>outside</p>
        <ProviderSelect
          toolModes={["chat"]}
          value="deepseek/v4"
          onChange={vi.fn()}
        />
      </div>,
    );
    fireEvent.click(await screen.findByRole("button", { expanded: false }));
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.mouseDown(screen.getByText("outside"));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("cannot be opened when disabled", async () => {
    get.mockResolvedValue([FREE_MODEL]);
    render(
      <ProviderSelect
        toolModes={["chat"]}
        value="deepseek/v4"
        onChange={vi.fn()}
        disabled
      />,
    );

    fireEvent.click(await screen.findByRole("button", { expanded: false }));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("treats API failures as 'no models'", async () => {
    get.mockRejectedValue(new Error("500"));
    render(<ProviderSelect toolModes={["chat"]} value="" onChange={vi.fn()} />);

    expect(
      await screen.findByText("No models available for this tool."),
    ).toBeTruthy();
  });
});
