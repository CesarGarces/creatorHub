/** Mirrors the API (tools/content-planner/backend). Dates are ISO strings. */

export const CONTENT_EVENT_TYPES = [
  "IDEATION",
  "SCRIPTING",
  "RECORDING",
  "EDITING",
  "THUMBNAIL",
  "PUBLISHING",
  "LIVESTREAM",
  "OTHER",
] as const;
export type ContentEventType = (typeof CONTENT_EVENT_TYPES)[number];

export const CONTENT_EVENT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;
export type ContentEventStatus = (typeof CONTENT_EVENT_STATUSES)[number];

export const CONTENT_PLATFORMS = [
  "youtube-long",
  "youtube-short",
  "tiktok",
  "reels",
  "twitch",
  "other",
] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const CUSTOM_TYPE_NAME_MAX = 40;

export const CUSTOM_PLATFORM_NAME_MAX = 40;

export interface ContentCustomType {
  id: string;
  name: string;
  /** A PaletteColor; kept as string because it comes from the API. */
  color: string;
  /** A PaletteIcon ("tag" when absent). */
  icon?: string;
}

export interface ContentCustomPlatform {
  id: string;
  name: string;
}

/** Totals over every session of the user (cancelled excluded). */
export interface ContentPlannerStats {
  sessions: number;
  plannedMinutes: number;
  done: number;
}

export interface ContentProjectSummary {
  id: string;
  title: string;
  platform: string | null;
}

export interface ContentEvent {
  id: string;
  projectId: string | null;
  /** Set when the session uses a custom type (its `type` is then OTHER). */
  customTypeId?: string | null;
  customType?: ContentCustomType | null;
  title: string;
  type: ContentEventType;
  status: ContentEventStatus;
  startAt: string;
  endAt: string;
  notes: string | null;
  project?: ContentProjectSummary | null;
}

export interface ContentEventConflict {
  id: string;
  title: string;
  type: ContentEventType;
  startAt: string;
  endAt: string;
}

export interface ContentProject {
  id: string;
  title: string;
  platform: string | null;
  customPlatformId?: string | null;
  customPlatform?: ContentCustomPlatform | null;
  publishAt: string | null;
  notes: string | null;
  progress: { total: number; done: number };
  nextEvent: Pick<
    ContentEvent,
    "id" | "title" | "type" | "status" | "startAt" | "endAt" | "customType"
  > | null;
}

export interface ContentEventInput {
  title: string;
  type: ContentEventType;
  status?: ContentEventStatus;
  startAt: string;
  endAt: string;
  notes?: string;
  projectId?: string;
  customTypeId?: string;
}

export type ContentEventPatch = Partial<
  Omit<ContentEventInput, "notes" | "projectId" | "customTypeId">
> & {
  notes?: string | null;
  projectId?: string | null;
  customTypeId?: string | null;
};

/** A session created with its project; customised steps send their look. */
export type PlannedEventInput = Omit<
  ContentEventInput,
  "projectId" | "customTypeId"
> & {
  customType?: { name: string; color: string; icon: string };
};

export interface ContentProjectInput {
  title: string;
  platform?: ContentPlatform;
  customPlatformId?: string;
  publishAt?: string;
  notes?: string;
  events?: PlannedEventInput[];
}
