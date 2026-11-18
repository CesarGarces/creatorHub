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
  AssistantActionResult,
  AssistantCalendarEvent,
} from "@creator-hub/shared-types";
import {
  CONTENT_EVENT_TYPES,
  DEFAULT_REMINDER_MINUTES,
  LIMITS,
  REMINDER_OPTIONS,
  type ContentEventTypeValue,
} from "./content-planner.constants";
import { ContentPlannerService } from "./content-planner.service";

const TOOL_ID = "content-planner";
/** A session may be created up to this long after "now" is already past. */
const PAST_TOLERANCE_MS = 5 * 60_000;
const MAX_LISTED = 30;
const MAX_AGENDA_DAYS = 14;

export const CREATE_EVENT_ACTION = "calendar.create_event";
export const LIST_EVENTS_ACTION = "calendar.list_events";

function plannerUrl(instant: Date): string {
  return `/tools/content-planner?date=${encodeURIComponent(instant.toISOString())}`;
}

function toCard(event: {
  id: string;
  title: string;
  type: string;
  status?: string;
  startAt: Date;
  endAt: Date;
}): AssistantCalendarEvent {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    status: event.status,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
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

const fail = (summary: string): AssistantActionResult => ({
  ok: false,
  summary,
});

/**
 * What the AI assistant can do in the Content Planner (§14e, §14g):
 * create a session and read the agenda. Registered in the global
 * AssistantActionRegistry at startup; everything goes through
 * ContentPlannerService, so the assistant gets the same validation,
 * default reminder and overlap warnings as the calendar UI.
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
    return [
      {
        name: CREATE_EVENT_ACTION,
        toolId: TOOL_ID,
        mutates: true,
        description:
          "Create a session (plan/event) in the user's Content Planner calendar. Needs its name, the date, the start time and the end time (or a duration) — ask the user for whichever is missing, never assume a length. Dates and times are the user's local time.",
        parameters: [
          {
            name: "title",
            type: "string",
            required: true,
            maxLength: LIMITS.titleMaxLength,
            description:
              'Name of the session, in the user\'s language (e.g. "Record the unboxing video")',
          },
          {
            name: "date",
            type: "date",
            required: true,
            description: "Day of the session (YYYY-MM-DD)",
          },
          {
            name: "startTime",
            type: "time",
            required: true,
            description: "Start time (HH:mm, 24h)",
          },
          {
            name: "endTime",
            type: "time",
            required: false,
            description:
              "End time (HH:mm, 24h) on the same day. Give endTime or durationMinutes",
          },
          {
            name: "durationMinutes",
            type: "integer",
            required: false,
            min: 5,
            max: 24 * 60,
            description:
              "Length in minutes (use it when the user gives a duration or the session ends after midnight)",
          },
          {
            name: "type",
            type: "string",
            required: false,
            enum: CONTENT_EVENT_TYPES,
            description:
              "Kind of session, inferred from its name (recording → RECORDING, editing → EDITING, live → LIVESTREAM…). OTHER for meetings and anything else",
          },
          {
            name: "notes",
            type: "string",
            required: false,
            maxLength: 1000,
            description: "Extra details the user mentioned (optional)",
          },
          {
            name: "reminderMinutes",
            type: "integer",
            required: false,
            enum: REMINDER_OPTIONS,
            description: `Notify this many minutes before it starts (default ${DEFAULT_REMINDER_MINUTES}; 1440 = a day before)`,
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
        execute: (args, context) => this.createEvent(args, context),
      },
      {
        name: LIST_EVENTS_ACTION,
        toolId: TOOL_ID,
        mutates: false,
        description:
          'Read the sessions already planned in the user\'s calendar for one or more days — to answer "what do I have tomorrow?" or to check a time is free before creating a session.',
        parameters: [
          {
            name: "date",
            type: "date",
            required: true,
            description: "First day to list (YYYY-MM-DD)",
          },
          {
            name: "days",
            type: "integer",
            required: false,
            min: 1,
            max: MAX_AGENDA_DAYS,
            description: "How many days from that date (default 1)",
          },
        ],
        example: {
          request: "Do I have anything planned on May 12?",
          args: { date: "2026-05-12" },
        },
        execute: (args, context) => this.listEvents(args, context),
      },
    ];
  }

  async createEvent(
    args: AssistantActionArgs,
    { userId, timeZone, now }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const title = String(args.title);
    const date = String(args.date);
    const startTime = String(args.startTime);
    const endTime = args.endTime === undefined ? null : String(args.endTime);
    const duration =
      args.durationMinutes === undefined ? null : Number(args.durationMinutes);

    if (endTime === null && duration === null) {
      return fail(
        "Missing the end time or the duration. Ask the user when it ends.",
      );
    }

    let startAt: Date;
    let endAt: Date;
    try {
      startAt = zonedDateTimeToUtc(date, startTime, timeZone);
      if (duration !== null) {
        endAt = new Date(startAt.getTime() + duration * 60_000);
      } else if (endTime! > startTime) {
        endAt = zonedDateTimeToUtc(date, endTime!, timeZone);
      } else {
        return fail(
          `The end time (${endTime}) is not after the start time (${startTime}). Ask the user for the right end time, or use durationMinutes if it ends after midnight.`,
        );
      }
    } catch (error) {
      if (error instanceof NonexistentLocalTimeError) {
        return fail(`${error.message}. Ask the user for another time.`);
      }
      throw error;
    }

    if (startAt.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
      const local = zonedParts(now, timeZone);
      return fail(
        `That start (${date} ${startTime}) is in the past — it is now ${local.weekday} ${local.date} ${local.time}. Ask the user for a future date or time.`,
      );
    }

    const { event, conflicts } = await this.planner.createEvent(userId, {
      title,
      type: (args.type as ContentEventTypeValue | undefined) ?? "OTHER",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      notes: args.notes === undefined ? undefined : String(args.notes),
      reminderMinutes:
        args.reminderMinutes === undefined
          ? undefined
          : Number(args.reminderMinutes),
    });

    const reminder =
      event.reminderMinutes === null
        ? "no reminder"
        : `reminder ${event.reminderMinutes} min before`;
    let summary = `Created "${event.title}" (${event.type}) on ${localSpan(
      event.startAt,
      event.endAt,
      timeZone,
    )} (${timeZone}), ${reminder}.`;
    if (conflicts.length > 0) {
      summary += ` Warning — it overlaps with: ${conflicts
        .map((c) => `"${c.title}" ${localSpan(c.startAt, c.endAt, timeZone)}`)
        .join("; ")}.`;
    }

    return {
      ok: true,
      summary,
      data: {
        kind: "calendar-event",
        event: toCard(event),
        conflicts: conflicts.map(toCard),
        url: plannerUrl(event.startAt),
      },
    };
  }

  async listEvents(
    args: AssistantActionArgs,
    { userId, timeZone }: AssistantActionContext,
  ): Promise<AssistantActionResult> {
    const first = String(args.date);
    const days = args.days === undefined ? 1 : Number(args.days);
    const from = startOfLocalDay(first, timeZone);
    const to = startOfLocalDay(addDaysToIsoDate(first, days), timeZone);

    const events = (
      await this.planner.listEvents(userId, {
        from: from.toISOString(),
        to: to.toISOString(),
      })
    ).filter((e) => e.status !== "CANCELLED");

    const span = days === 1 ? first : `${first} + ${days - 1} days`;
    const lines = events
      .slice(0, MAX_LISTED)
      .map(
        (e) =>
          `- ${localSpan(e.startAt, e.endAt, timeZone)} "${e.title}" (${e.type}, ${e.status})`,
      );
    const summary =
      events.length === 0
        ? `No sessions planned for ${span} (${timeZone}).`
        : `${events.length} session(s) for ${span} (${timeZone}):\n${lines.join("\n")}${
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
        events: events.slice(0, MAX_LISTED).map(toCard),
        url: plannerUrl(from),
      },
    };
  }
}

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
