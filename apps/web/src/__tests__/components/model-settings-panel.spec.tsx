import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const providerSelect = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}));

vi.mock("@/components/provider-select", () => ({
  ProviderSelect: (props: Record<string, unknown>) => {
    providerSelect.props = props;
    return <div data-testid="provider-select" />;
  },
}));

import {
  DEFAULT_MODEL_SETTINGS,
  ModelSettingsPanel,
} from "@/components/chat/model-settings-panel";

describe("ModelSettingsPanel", () => {
  const onUpdate = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    render(
      <ModelSettingsPanel
        settings={{ model: "deepseek/v4", temperature: 0.7, maxTokens: 1000 }}
        onUpdate={onUpdate}
        onClose={onClose}
      />,
    );
  });

  it("exposes sensible defaults", () => {
    expect(DEFAULT_MODEL_SETTINGS).toEqual({
      model: "deepseek-ai/DeepSeek-V4-Flash",
      temperature: 0.7,
      maxTokens: 300,
    });
  });

  it("shows the current values", () => {
    expect(screen.getByText("0.7")).toBeTruthy();
    expect(screen.getByText((1000).toLocaleString())).toBeTruthy();
    expect(
      (screen.getByLabelText("Temperature") as HTMLInputElement).value,
    ).toBe("0.7");
  });

  it("limits the model picker to chat/text models", () => {
    expect(providerSelect.props).toMatchObject({
      toolModes: ["chat", "text"],
      value: "deepseek/v4",
    });
  });

  it("reports the selected model id", () => {
    const onChange = providerSelect.props!.onChange as (
      id: string,
      m: { modelId: string },
    ) => void;
    onChange("row-id", { modelId: "anthropic/claude" });
    expect(onUpdate).toHaveBeenCalledWith({ model: "anthropic/claude" });
  });

  it("reports slider changes as numbers", () => {
    fireEvent.change(screen.getByLabelText("Temperature"), {
      target: { value: "0.3" },
    });
    fireEvent.change(screen.getByLabelText("Max Tokens"), {
      target: { value: "450" },
    });

    expect(onUpdate).toHaveBeenCalledWith({ temperature: 0.3 });
    expect(onUpdate).toHaveBeenCalledWith({ maxTokens: 450 });
  });

  it("bounds max tokens to 100–1000", () => {
    const slider = screen.getByLabelText("Max Tokens") as HTMLInputElement;
    expect([slider.min, slider.max, slider.step]).toEqual([
      "100",
      "1000",
      "50",
    ]);
  });

  it("closes", () => {
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalled();
  });
});
