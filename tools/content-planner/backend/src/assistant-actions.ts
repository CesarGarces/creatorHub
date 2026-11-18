import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import {
  AssistantActionRegistry,
  type AssistantActionHandler,
} from "@creator-hub/tool-sdk";
import {
  NonexistentLocalTimeError,
  addDaysToIsoDate,
  zonedDateTimeToUtc,
  zonedParts,
} from "@creator-hub/shared-utils";
import type {
  AssistantActionArgs,
  AssistantActionContext,
  AssistantActionParameter,
  AssistantActionResult,
  AssistantCalendarEvent,
  AssistantCalendarProject,
} from "@creator-hub/shared-types";
import {
  CONTENT_EVENT_STATUSES,
  CONTENT_EVENT_TYPES,
  CONTENT_PLATFORMS,
  DEFAULT_REMINDER_MINUTES,
  LIMITS,
  REMINDER_OPTIONS,
  type ContentEventStatusValue,
  type ContentEventTypeValue,
} from "./content-planner.constants";
import { ContentPlannerService } from "./content-planner.service";

const TOOL_ID = "content-planner";
/** A session may start up to this long before "now" (rounding, slow talk). */
const PAST_TOLERANCE_MS = 5 * 60_000;
const MAX_LISTED = 30;
const MAX_AGENDA_DAYS = 62;
/** `reminderMinutes` value meaning "no reminder". */
const NO_REMINDER = -1;
/** `projectId` value that takes a session out of its project. */
const NO_PROJECT = "none";

export const CREATE_EVENT_ACTION = "calendar.create_event";
export const LIST_EVENTS_ACTION = "calendar.list_events";
export const UPDATE_EVENT_ACTION = "calendar.update_event";
export const DELETE_EVENT_ACTION = "calendar.delete_event";
export const LIST_PROJECTS_ACTION = "calendar.list_projects";
export const CREATE_PROJECT_ACTION = "calendar.create_project";
export const UPDATE_PROJECT_ACTION = "calendar.update_project";
export const DELETE_PROJECT_ACTION = "calendar.delete_project";

interface EventLike {
  id: string;
  title: string;
  type: string;
  status?: string;
  startAt: Date;
  endAt: Date;
}

interface ProjectLike {
  id: string;
  title: string;
  platform: string | null;
  publishAt: Date | null;
  customPlatform?: { name: string } | null;
}

function plannerUrl(instant: Date | null): string {
  return instant
    ? `/tools/content-planner?date=${encodeURIComponent(instant.toISOString())}`
    : "/tools/content-planner";
}

function eventCard(event: EventLike): AssistantCalendarEvent {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    ...(event.status ? { status: event.status } : {}),
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
  };
}

function projectCard(
  project: ProjectLike,
  sessions?: { total: number; done: number },
): AssistantCalendarProject {
  return {
    id: project.id,
    title: project.title,
    platform: project.customPlatform?.name ?? project.platform,
    publishAt: project.publishAt?.toISOString() ?? null,
    ...(sessions ? { sessions } : {}),
  };
}

/** "Fri 2026-11-27 15:00–16:00" in the user's zone. */
function localSpan(startAt: Date, endAt: Date, timeZone: string): string {
  const start = zonedParts(startAt, timeZone);
  const end = zonedParts(endAt, timeZone);
  const endText =
    end.date === start.date ? end.time : `${end.date} ${end.time}`;
  return `${start.weekday} ${start.date} ${start.time}–${endText}`;
}

function localMoment(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.weekday} ${p.date} ${p.time}`;
}

function describeEvent(e: EventLike, timeZone: string): string {
  return `"${e.title}" (${e.type}${e.status ? `, ${e.status}` : ""}) ${localSpan(e.startAt, e.endAt, timeZone)}`;
}

/** Lowercase, no accents: "Grabación" matches "grabacion". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function reminderArg(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  return Number(value) === NO_REMINDER ? null : Number(value);
}

const fail = (summary: string): AssistantActionResult => ({
  ok: false,
  summary,
});

/** Local midnight of `date` (01:00 where midnight is skipped by DST). */
function startOfLocalDay(date: string, timeZone: string): Date {
  try {
    return zonedDateTimeToUtc(date, "00:00", timeZone);
  } catch (error) {
    if (error instanceof NonexistentLocalTimeError) {
      return zonedDateTimeToUtc(date, "01:00", timeZone);
    }
    throw error;
  }
}

class TimeError extends Error {}

/**
 * Start/end instants from local date + times. `base` is the current slot
 * of a session being moved: missing parts keep its day, start and length.
 */
function resolveSlot(
  args: AssistantActionArgs,
  timeZone: string,
  base?: { startAt: Date; endAt: Date },
): { startAt: Date; endAt: Date } {
  const current = base ? zonedParts(base.startAt, timeZone) : null;
  const date = (args.date as string | undefined) ?? current?.date;
  const startTime = (args.startTime as string | undefined) ?? current?.time;
  const endTime = args.endTime as string | undefined;
  const duration =
    args.durationMinutes === undefined ? null : Number(args.durationMinutes);
  if (!date || !startTime) {
    throw new TimeError("Missing the date or the start time. Ask the user.");
  }
  try {
    const startAt = zonedDateTimeToUtc(date, startTime, timeZone);
    if (duration !== null) {
      return {
        startAt,
        endAt: new Date(startAt.getTime() + duration * 60_000),
      };
    }
    if (endTime !== undefined) {
      if (endTime <= startTime) {
        throw new TimeError(
          `The end time (${endTime}) is not after the start time (${startTime}). Ask the user for the right end time, or use durationMinutes if it ends after midnight.`,
        );
      }
      return { startAt, endAt: zonedDateTimeToUtc(date, endTime, timeZone) };
    }
    if (base) {
      // Moved without a new end: it keeps its length.
      const length = base.endAt.getTime() - base.startAt.getTime();
      return { startAt, endAt: new Date(startAt.getTime() + length) };
    }
    throw new TimeError(
      "Missing the end time or the duration. Ask the user when it ends.",
    );
  } catch (error) {
    if (error instanceof NonexistentLocalTimeError) {
      throw new TimeError(`${error.message}. Ask the user for another time.`);
    }
    throw error;
  }
}

function assertNotPast(startAt: Date, now: Date, timeZone: string): void {
  if (startAt.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    throw new TimeError(
      `That start (${localMoment(startAt, timeZone)}) is in the past — it is now ${localMoment(now, timeZone)}. Ask the user for a future date or time.`,
    );
  }
}

// ─── Parameters ──────────────────────────────────────────────────────────

const P = {
  eventId: {
    name: "eventId",
    type: "string",
    required: true,
    maxLength: 64,
    description:
      "Id of the session, from the [id …] of a calendar.list_events result",
  },
  projectIdRequired: {
    name: "projectId",
    type: "string",
    required: true,
    maxLength: 64,
    description:
      "Id of the video project, from the [id …] of a calendar.list_projects result",
  },
  title: (required: boolean): AssistantActionParameter => ({
    name: "title",
    type: "string",
    required,
    maxLength: LIMITS.titleMaxLength,
    description: 'Name, in the user\'s language (e.g. "Record the unboxing")',
  }),
  date: (required: boolean, description: string): AssistantActionParameter => ({
    name: "date",
    type: "date",
    required,
    description,
  }),
  startTime: (required: boolean): AssistantActionParameter => ({
    name: "startTime",
    type: "time",
    required,
    description: "Start time (HH:mm, 24h)",
  }),
  endTime: {
    name: "endTime",
    type: "time",
    required: false,
    description: "End time (HH:mm, 24h) on the same day",
  },
  durationMinutes: {
    name: "durationMinutes",
    type: "integer",
    required: false,
    min: 5,
    max: 24 * 60,
    description:
      "Length in minutes (when the user gives a duration, or it ends after midnight)",
  },
  type: {
    name: "type",
    type: "string",
    required: false,
    enum: CONTENT_EVENT_TYPES,
    description:
      "Kind of session, inferred from its name (recording → RECORDING, editing → EDITING, live → LIVESTREAM…). OTHER for meetings and anything else",
  },
  status: {
    name: "status",
    type: "string",
    required: false,
    enum: CONTENT_EVENT_STATUSES,
    description:
      "PLANNED, IN_PROGRESS, DONE (finished) or CANCELLED (kept in the calendar, crossed out)",
  },
  notes: {
    name: "notes",
    type: "string",
    required: false,
    maxLength: 1000,
    description: "Extra details (replaces the current notes)",
  },
  reminder: {
    name: "reminderMinutes",
    type: "integer",
    required: false,
    enum: [...REMINDER_OPTIONS, NO_REMINDER],
    description: `Notify this many minutes before it starts (default ${DEFAULT_REMINDER_MINUTES}; 1440 = a day before; ${NO_REMINDER} = no reminder)`,
  },
  platform: {
    name: "platform",
    type: "string",
    required: false,
    enum: CONTENT_PLATFORMS,
    description: "Where the video is published",
  },
  publishDate: {
    name: "publishDate",
    type: "date",
    required: false,
    description: "Publish day (YYYY-MM-DD); give it with publishTime",
  },
  publishTime: {
    name: "publishTime",
    type: "time",
    required: false,
    description: "Publish time (HH:mm, 24h)",
  },
} satisfies Record<
  string,
  AssistantActionParameter | ((...args: never[]) => AssistantActionParameter)
>;

/**
 * What the AI assistant can do in the Content Planner (§14e, §14g): see,
 * create, edit and delete sessions and video projects. Registered in the
 * global AssistantActionRegistry at startup; everything goes through
 * ContentPlannerService, so the assistant gets the same validation,
 * reminders, ownership checks and overlap warnings as the calendar UI.
 * Deleting requires the user's confirmation (enforced by the assistant).
 */
@Injectable()
export class ContentPlannerAssistantActions implements OnModuleInit {
  constructor(
    private readonly planner: ContentPlannerService,
    @Optional() private readonly registry?: AssistantActionRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.registry) return;
    for (const action of this.actions()) this.registry.register(action);
  }

  actions(): AssistantActionHandler[] {
    const run =
      (
        fn: (
          args: AssistantActionArgs,
          context: AssistantActionContext,
        ) => Promise<AssistantActionResult>,
      ) =>
      async (args: AssistantActionArgs, context: AssistantActionContext) => {
        try {
          return await fn(args, context);
        } catch (error) {
          if (error instanceof TimeError) return fail(error.message);
          throw error;
        }
      };

    return [
      {
        name: LIST_EVENTS_ACTION,
        toolId: TOOL_ID,
        mutates: false,
        description:
          'See the sessions in the user\'s calendar for one or more days, optionally only those whose name matches a text. Use it to answer "what do I have tomorrow?", to check a time is free, and to find the id of a session before editing or deleting it.',
        parameters: [
          P.date(true, "First day to list (YYYY-MM-DD)"),
          {
            name: "days",
            type: "integer",
            required: false,
            min: 1,
            max: MAX_AGENDA_DAYS,
            description: `How many days from that date (default 1; up to ${MAX_AGENDA_DAYS} to search ahead)`,
          },
          {
            name: "query",
            type: "string",
            required: false,
            maxLength: 80,
            description:
              'Only sessions whose name, notes or project contain this text (e.g. "unboxing")',
          },
        ],
        example: {
          request: "Do I have anything planned on May 12?",
          args: { date: "2026-05-12" },
        },
        execute: run((args, ctx) => this.listEvents(args, ctx)),
      },
      {
        name: CREATE_EVENT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        description:
          "Create a session (plan/event) in the user's Content Planner calendar. Needs its name, the date, the start time and the end time (or a duration) — ask the user for whichever is missing, never assume a length.",
        parameters: [
          P.title(true),
          P.date(true, "Day of the session (YYYY-MM-DD)"),
          P.startTime(true),
          P.endTime,
          P.durationMinutes,
          P.type,
          P.notes,
          P.reminder,
          {
            name: "projectId",
            type: "string",
            required: false,
            maxLength: 64,
            description:
              "Video project it belongs to (id from calendar.list_projects), if the user says so",
          },
        ],
        example: {
          request: "Schedule editing the vlog on May 12 from 10 to 11:30 am",
          args: {
            title: "Edit the vlog",
            date: "2026-05-12",
            startTime: "10:00",
            endTime: "11:30",
            type: "EDITING",
          },
        },
        execute: run((args, ctx) => this.createEvent(args, ctx)),
      },
      {
        name: UPDATE_EVENT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        description:
          "Change a session: move it (new date and/or start time — it keeps its length unless a new end or duration is given), change its end, rename it, or change its type, status, notes, reminder or project. Only pass what changes.",
        parameters: [
          P.eventId,
          P.title(false),
          P.date(false, "New day (YYYY-MM-DD)"),
          P.startTime(false),
          P.endTime,
          P.durationMinutes,
          P.type,
          P.status,
          P.notes,
          P.reminder,
          {
            name: "projectId",
            type: "string",
            required: false,
            maxLength: 64,
            description: `Move it into this video project (id from calendar.list_projects), or "${NO_PROJECT}" to take it out of its project`,
          },
        ],
        execute: run((args, ctx) => this.updateEvent(args, ctx)),
      },
      {
        name: DELETE_EVENT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        requiresConfirmation: true,
        description:
          "Delete a session from the calendar for good. (To keep it but mark it as not happening, use calendar.update_event with status CANCELLED.)",
        parameters: [P.eventId],
        describe: run((args, ctx) => this.previewDeleteEvent(args, ctx)),
        execute: run((args, ctx) => this.deleteEvent(args, ctx)),
      },
      {
        name: LIST_PROJECTS_ACTION,
        toolId: TOOL_ID,
        mutates: false,
        description:
          "See the user's video projects (plans that group production sessions) with their publish date and progress, optionally only those whose name matches a text. Use it to find a project's id.",
        parameters: [
          {
            name: "query",
            type: "string",
            required: false,
            maxLength: 80,
            description: "Only projects whose name or notes contain this text",
          },
        ],
        execute: run((args, ctx) => this.listProjects(args, ctx)),
      },
      {
        name: CREATE_PROJECT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        description:
          "Create a video project (a plan that groups the sessions of one video), optionally with its publish date and time and platform. Its sessions are then created with calendar.create_event and its projectId.",
        parameters: [
          P.title(true),
          P.publishDate,
          P.publishTime,
          P.platform,
          P.notes,
        ],
        execute: run((args, ctx) => this.createProject(args, ctx)),
      },
      {
        name: UPDATE_PROJECT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        description:
          "Change a video project: rename it, change or remove its publish date/time, its platform or its notes. Only pass what changes.",
        parameters: [
          P.projectIdRequired,
          P.title(false),
          P.publishDate,
          P.publishTime,
          {
            name: "removePublishDate",
            type: "boolean",
            required: false,
            description: "true to clear the publish date",
          },
          P.platform,
          P.notes,
        ],
        execute: run((args, ctx) => this.updateProject(args, ctx)),
      },
      {
        name: DELETE_PROJECT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        requiresConfirmation: true,
        description:
          "Delete a video project for good, together with ALL of its sessions.",
        parameters: [P.projectIdRequired],
        describe: run((args, ctx) => this.previewDeleteProject(args, ctx)),
        execute: run((args, ctx) => this.deleteProject(args, ctx)),
      },
    ];
  }

  // ─── Sessions ──────────────────────────────────────────────────────────

  async listEvents(
    args: AssistantActionArgs,
    { userId, timeZone }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const first = String(args.date);
    const days = args.days === undefined ? 1 : Number(args.days);
    const query = args.query === undefined ? null : fold(String(args.query));
    const from = startOfLocalDay(first, timeZone);
    const to = startOfLocalDay(addDaysToIsoDate(first, days), timeZone);

    const events = (
      await this.planner.listEvents(userId, {
        from: from.toISOString(),
        to: to.toISOString(),
      })
    ).filter(
      (e) =>
        e.status !== "CANCELLED" &&
        (!query ||
          fold(
            `${e.title} ${e.notes ?? ""} ${e.project?.title ?? ""}`,
          ).includes(query)),
    );

    const span = days === 1 ? first : `${first} + ${days - 1} days`;
    const matching = query ? ` matching "${args.query}"` : "";
    const lines = events
      .slice(0, MAX_LISTED)
      .map(
        (e) =>
          `- [id ${e.id}] ${describeEvent(e, timeZone)}${
            e.project ? ` · project "${e.project.title}"` : ""
          }`,
      );
    const summary =
      events.length === 0
        ? `No sessions${matching} for ${span} (${timeZone}).`
        : `${events.length} session(s)${matching} for ${span} (${timeZone}):\n${lines.join("\n")}${
            events.length > MAX_LISTED
              ? `\n…and ${events.length - MAX_LISTED} more`
              : ""
          }`;

    return {
      ok: true,
      summary,
      data: {
        kind: "calendar-agenda",
        from: first,
        days,
        events: events.slice(0, MAX_LISTED).map(eventCard),
        url: plannerUrl(from),
      },
    };
  }

  async createEvent(
    args: AssistantActionArgs,
    { userId, timeZone, now }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const slot = resolveSlot(args, timeZone);
    assertNotPast(slot.startAt, now, timeZone);

    const { event, conflicts } = await this.planner.createEvent(userId, {
      title: String(args.title),
      type: (args.type as ContentEventTypeValue | undefined) ?? "OTHER",
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString(),
      notes: args.notes === undefined ? undefined : String(args.notes),
      reminderMinutes: reminderArg(args.reminderMinutes),
      ...(args.projectId ? { projectId: String(args.projectId) } : {}),
    });

    const reminder =
      event.reminderMinutes === null
        ? "no reminder"
        : `reminder ${event.reminderMinutes} min before`;
    return {
      ok: true,
      summary: `Created ${describeEvent(event, timeZone)} (${timeZone}), ${reminder}${
        event.project ? `, in project "${event.project.title}"` : ""
      }.${overlapNote(conflicts, timeZone)}`,
      data: {
        kind: "calendar-event",
        change: "created",
        event: eventCard(event),
        conflicts: conflicts.map(eventCard),
        url: plannerUrl(event.startAt),
      },
    };
  }

  async updateEvent(
    args: AssistantActionArgs,
    { userId, timeZone, now }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const eventId = String(args.eventId);
    const current = await this.planner.getEvent(userId, eventId);
    if (!current) {
      return fail(
        `No session with id ${eventId}. Look it up again with calendar.list_events.`,
      );
    }

    const moves =
      args.date !== undefined ||
      args.startTime !== undefined ||
      args.endTime !== undefined ||
      args.durationMinutes !== undefined;
    const slot = moves ? resolveSlot(args, timeZone, current) : null;
    if (slot && slot.startAt.getTime() !== current.startAt.getTime()) {
      assertNotPast(slot.startAt, now, timeZone);
    }

    const changes = Object.keys(args).filter((k) => k !== "eventId");
    if (changes.length === 0) {
      return fail("Nothing to change. Ask the user what to change.");
    }

    const projectId =
      args.projectId === undefined
        ? undefined
        : String(args.projectId) === NO_PROJECT
          ? null
          : String(args.projectId);

    const { event, conflicts } = await this.planner.updateEvent(
      userId,
      eventId,
      {
        ...(args.title !== undefined ? { title: String(args.title) } : {}),
        ...(args.type !== undefined
          ? { type: args.type as ContentEventTypeValue, customTypeId: null }
          : {}),
        ...(args.status !== undefined
          ? { status: args.status as ContentEventStatusValue }
          : {}),
        ...(args.notes !== undefined ? { notes: String(args.notes) } : {}),
        ...(args.reminderMinutes !== undefined
          ? { reminderMinutes: reminderArg(args.reminderMinutes) }
          : {}),
        ...(projectId !== undefined ? { projectId } : {}),
        ...(slot
          ? {
              startAt: slot.startAt.toISOString(),
              endAt: slot.endAt.toISOString(),
            }
          : {}),
      },
    );

    const moved =
      slot &&
      (slot.startAt.getTime() !== current.startAt.getTime() ||
        slot.endAt.getTime() !== current.endAt.getTime());
    return {
      ok: true,
      summary: `Updated ${describeEvent(event, timeZone)} (${timeZone})${
        moved
          ? ` — it was ${localSpan(current.startAt, current.endAt, timeZone)}`
          : ""
      }. Changed: ${changes.join(", ")}.${overlapNote(conflicts, timeZone)}`,
      data: {
        kind: "calendar-event",
        change: "updated",
        event: eventCard(event),
        ...(moved
          ? {
              previous: {
                startAt: current.startAt.toISOString(),
                endAt: current.endAt.toISOString(),
              },
            }
          : {}),
        conflicts: conflicts.map(eventCard),
        url: plannerUrl(event.startAt),
      },
    };
  }

  async previewDeleteEvent(
    args: AssistantActionArgs,
    { userId, timeZone }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const event = await this.planner.getEvent(userId, String(args.eventId));
    if (!event) {
      return fail(
        `No session with id ${String(args.eventId)}. Look it up again with calendar.list_events.`,
      );
    }
    return {
      ok: true,
      summary: `Would delete ${describeEvent(event, timeZone)} for good.`,
      data: {
        kind: "calendar-event",
        change: "deleted",
        event: eventCard(event),
        conflicts: [],
        url: plannerUrl(event.startAt),
      },
    };
  }

  async deleteEvent(
    args: AssistantActionArgs,
    context: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const preview = await this.previewDeleteEvent(args, context);
    if (!preview.ok) return preview;
    await this.planner.deleteEvent(context.userId, String(args.eventId));
    return {
      ...preview,
      summary: preview.summary.replace(
        /^Would delete (.*) for good\.$/,
        "Deleted $1.",
      ),
    };
  }

  // ─── Video projects ────────────────────────────────────────────────────

  async listProjects(
    args: AssistantActionArgs,
    { userId, timeZone }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const query = args.query === undefined ? null : fold(String(args.query));
    const projects = (await this.planner.listProjects(userId)).filter(
      (p) => !query || fold(`${p.title} ${p.notes ?? ""}`).includes(query),
    );
    const shown = projects.slice(0, MAX_LISTED);
    const lines = shown.map((p) => {
      const parts = [
        `- [id ${p.id}] "${p.title}"`,
        p.customPlatform?.name ?? p.platform ?? null,
        p.publishAt
          ? `publish ${localMoment(p.publishAt, timeZone)}`
          : "no publish date",
        `${p.progress.done}/${p.progress.total} sessions done`,
        p.nextEvent
          ? `next: "${p.nextEvent.title}" ${localSpan(p.nextEvent.startAt, p.nextEvent.endAt, timeZone)}`
          : null,
      ];
      return parts.filter(Boolean).join(" · ");
    });
    const matching = query ? ` matching "${args.query}"` : "";
    return {
      ok: true,
      summary:
        projects.length === 0
          ? `No video projects${matching}.`
          : `${projects.length} video project(s)${matching} (${timeZone}):\n${lines.join("\n")}`,
      data: {
        kind: "calendar-projects",
        projects: shown.map((p) => projectCard(p, p.progress)),
        url: plannerUrl(null),
      },
    };
  }

  async createProject(
    args: AssistantActionArgs,
    { userId, timeZone, now }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const publishAt = this.publishMoment(args, timeZone, null);
    if (publishAt) assertNotPast(publishAt, now, timeZone);
    const { project } = await this.planner.createProject(userId, {
      title: String(args.title),
      ...(args.platform ? { platform: String(args.platform) } : {}),
      ...(publishAt ? { publishAt: publishAt.toISOString() } : {}),
      ...(args.notes !== undefined ? { notes: String(args.notes) } : {}),
    });
    return {
      ok: true,
      summary: `Created the video project "${project.title}"${
        project.publishAt
          ? `, publishing ${localMoment(project.publishAt, timeZone)} (${timeZone})`
          : ""
      } [id ${project.id}]. It has no sessions yet: offer to schedule them (calendar.create_event with this projectId).`,
      data: {
        kind: "calendar-project",
        change: "created",
        project: projectCard(project, { total: 0, done: 0 }),
        url: plannerUrl(project.publishAt),
      },
    };
  }

  async updateProject(
    args: AssistantActionArgs,
    { userId, timeZone, now }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const projectId = String(args.projectId);
    const current = await this.planner.getProject(userId, projectId);
    if (!current) {
      return fail(
        `No video project with id ${projectId}. Look it up again with calendar.list_projects.`,
      );
    }
    const changes = Object.keys(args).filter((k) => k !== "projectId");
    if (changes.length === 0) {
      return fail("Nothing to change. Ask the user what to change.");
    }
    const publishAt =
      args.removePublishDate === true
        ? null
        : this.publishMoment(args, timeZone, current.publishAt);
    if (publishAt) assertNotPast(publishAt, now, timeZone);

    const project = await this.planner.updateProject(userId, projectId, {
      ...(args.title !== undefined ? { title: String(args.title) } : {}),
      ...(args.platform !== undefined
        ? { platform: String(args.platform), customPlatformId: null }
        : {}),
      ...(args.notes !== undefined ? { notes: String(args.notes) } : {}),
      ...(args.removePublishDate === true
        ? { publishAt: null }
        : publishAt
          ? { publishAt: publishAt.toISOString() }
          : {}),
    });
    return {
      ok: true,
      summary: `Updated the video project "${project.title}"${
        project.publishAt
          ? `, publishing ${localMoment(project.publishAt, timeZone)} (${timeZone})`
          : ", no publish date"
      }. Changed: ${changes.join(", ")}.`,
      data: {
        kind: "calendar-project",
        change: "updated",
        project: projectCard(project),
        url: plannerUrl(project.publishAt),
      },
    };
  }

  async previewDeleteProject(
    args: AssistantActionArgs,
    { userId, timeZone }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const project = await this.planner.getProject(
      userId,
      String(args.projectId),
    );
    if (!project) {
      return fail(
        `No video project with id ${String(args.projectId)}. Look it up again with calendar.list_projects.`,
      );
    }
    const sessions = project._count.events;
    return {
      ok: true,
      summary: `Would delete the video project "${project.title}"${
        project.publishAt
          ? ` (publishing ${localMoment(project.publishAt, timeZone)})`
          : ""
      } and its ${sessions} session(s) for good.`,
      data: {
        kind: "calendar-project",
        change: "deleted",
        project: projectCard(project, { total: sessions, done: 0 }),
        url: plannerUrl(null),
      },
    };
  }

  async deleteProject(
    args: AssistantActionArgs,
    context: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const preview = await this.previewDeleteProject(args, context);
    if (!preview.ok) return preview;
    await this.planner.deleteProject(context.userId, String(args.projectId));
    return {
      ...preview,
      summary: preview.summary.replace(
        /^Would delete (.*) for good\.$/,
        "Deleted $1.",
      ),
    };
  }

  /**
   * Publish instant from publishDate/publishTime; a missing half comes from
   * the current publish moment, else the user must be asked.
   */
  private publishMoment(
    args: AssistantActionArgs,
    timeZone: string,
    current: Date | null,
  ): Date | null {
    const date = args.publishDate as string | undefined;
    const time = args.publishTime as string | undefined;
    if (date === undefined && time === undefined) return null;
    const base = current ? zonedParts(current, timeZone) : null;
    const day = date ?? base?.date;
    const clock = time ?? base?.time;
    if (!day) throw new TimeError("Missing the publish date. Ask the user.");
    if (!clock) throw new TimeError("Missing the publish time. Ask the user.");
    try {
      return zonedDateTimeToUtc(day, clock, timeZone);
    } catch (error) {
      if (error instanceof NonexistentLocalTimeError) {
        throw new TimeError(`${error.message}. Ask the user for another time.`);
      }
      throw error;
    }
  }
}

function overlapNote(conflicts: EventLike[], timeZone: string): string {
  if (conflicts.length === 0) return "";
  return ` Warning — it overlaps with: ${conflicts
    .map((c) => `"${c.title}" ${localSpan(c.startAt, c.endAt, timeZone)}`)
    .join("; ")}.`;
}
