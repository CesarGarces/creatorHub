import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DEFAULT_VOICE_SETTINGS } from "@creator-hub/shared-types";
import { VoiceSettingsForm } from "@admin/components/voice-settings/voice-settings-form";
import { withAdminApp } from "../../../.storybook/decorators/admin";
import { viewport } from "../../../.storybook/viewports";

/** A silent WAV, so "play" works without the API. */
const SILENT_WAV =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

const saved = {
  ...DEFAULT_VOICE_SETTINGS,
  stt: { ...DEFAULT_VOICE_SETTINGS.stt, creditsPerMinute: 60 },
  tts: {
    ...DEFAULT_VOICE_SETTINGS.tts,
    creditsPerMinute: 120,
    voices: {
      ...DEFAULT_VOICE_SETTINGS.tts.voices,
      es: { model: "aura-2", voice: "aura-2-estrella-es" },
    },
  },
  updatedAt: "2026-11-29T10:00:00.000Z",
};

const meta = {
  title: "Admin/Voice/VoiceSettingsForm",
  component: VoiceSettingsForm,
  decorators: [withAdminApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Admin → Voice (STT & TTS). Deepgram speech-to-text model and its price per minute; the Aura voice (“actor”) of English, Spanish and Portuguese — picked from the catalog or typed as a Deepgram id — with a play button; the text-to-speech price per minute; and the **Free plan limit**: minutes with Robotina (their voice + hers) every month or once, after which Free users are invited to upgrade. Prices show what they mean for users (1 minute of voice input, a 20-second answer). Validates like the API; the save bar sticks to the bottom.",
      },
    },
  },
  argTypes: {
    settings: {
      description: "Saved settings (`GET /admin/voice-settings`).",
      control: "object",
    },
    ttsProvider: {
      description:
        "Who speaks: `deepgram` (API key set), `mock` (development) or `null` (no key — a warning is shown).",
      control: "inline-radio",
      options: ["deepgram", "mock", null],
    },
    onSave: {
      description: "Receives the `PUT /admin/voice-settings` body.",
      control: false,
    },
    saving: { description: "A save is in flight.", control: "boolean" },
    onPreview: {
      description:
        "Speaks a sample (`POST /admin/voice-settings/preview`); omit to hide the play buttons.",
      control: false,
    },
    onPreviewError: {
      description: "Called when a sample can't be played.",
      control: false,
    },
  },
  args: {
    settings: saved,
    ttsProvider: "deepgram",
    saving: false,
    onSave: fn(),
    onPreview: fn(async () => ({ data: SILENT_WAV, mimeType: "audio/wav" })),
    onPreviewError: fn(),
  },
} satisfies Meta<typeof VoiceSettingsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };

export const Mobile: Story = { globals: viewport("mobile") };

/** Never saved: the defaults, and no Deepgram key on the API. */
export const DefaultsWithoutDeepgram: Story = {
  args: { settings: DEFAULT_VOICE_SETTINGS, ttsProvider: null },
  globals: viewport("desktop"),
};

/** Editing: a typed voice id and prices, then Save. */
export const EditAndSave: Story = {
  globals: viewport("desktop"),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const sttRate = canvas.getByLabelText("Credits per minute", {
      selector: "#voice-stt-rate",
    });
    await userEvent.clear(sttRate);
    await userEvent.type(sttRate, "30");
    await expect(
      canvas.getByText("1 minute of voice input = 30 credits"),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      canvas.getByLabelText("Voice (Portuguese)"),
      "__custom__",
    );
    await userEvent.type(
      canvas.getByLabelText("Deepgram voice id (Portuguese)"),
      "flux-paula-pt",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save Changes" }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sttCreditsPerMinute: 30,
        ttsVoices: expect.objectContaining({
          pt: { model: "flux", voice: "flux-paula-pt" },
        }),
      }),
    );
  },
};

/** Free plan: 20 minutes with Robotina in total, then "upgrade". */
export const FreePlanLimit: Story = {
  globals: viewport("desktop"),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("switch", { name: "Limit Robotina on the Free plan" }),
    );
    const minutes = canvas.getByLabelText("Minutes");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "20");
    await userEvent.selectOptions(
      canvas.getByLabelText("Minutes come back"),
      "lifetime",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save Changes" }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        freeTierMinutes: 20,
        freeTierPeriod: "lifetime",
      }),
    );
  },
};

/** Invalid values are explained next to each field, nothing is saved. */
export const ValidationErrors: Story = {
  globals: viewport("desktop"),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const ttsRate = canvas.getByLabelText("Credits per minute", {
      selector: "#voice-tts-rate",
    });
    await userEvent.clear(ttsRate);
    await userEvent.type(ttsRate, "6001");
    await userEvent.click(canvas.getByRole("button", { name: "Save Changes" }));
    await expect(
      canvas.getByText("Between 0 and 6,000, with up to 2 decimals"),
    ).toBeInTheDocument();
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};
