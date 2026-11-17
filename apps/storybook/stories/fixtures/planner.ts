import { addDays, startOfWeek } from "@/lib/content-planner/dates";
import type {
  ContentEvent,
  ContentPlannerStats,
  ContentProject,
} from "@/lib/content-planner/types";

/** Monday of the current week, so "today" and the "now" line show up. */
export const WEEK_START = startOfWeek(new Date());

/** `dayIndex` 0 = Monday of the current week, at `hour:minute` local time. */
function at(dayIndex: number, hour: number, minute = 0): string {
  const d = addDays(WEEK_START, dayIndex);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const unboxing = {
  id: "proj-1",
  title: "Phone unboxing",
  platform: "youtube-long",
};

export const PLANNER_EVENTS: ContentEvent[] = [
  {
    id: "ev-1",
    projectId: "proj-1",
    title: "Brainstorm hooks",
    type: "IDEATION",
    status: "DONE",
    startAt: at(0, 9),
    endAt: at(0, 10),
    notes: null,
    project: unboxing,
  },
  {
    id: "ev-2",
    projectId: "proj-1",
    title: "Script the unboxing video",
    type: "SCRIPTING",
    status: "IN_PROGRESS",
    startAt: at(1, 10),
    endAt: at(1, 11, 30),
    notes: "Keep the intro under 20 seconds",
    reminderMinutes: 15,
    project: unboxing,
  },
  {
    id: "ev-3",
    projectId: "proj-1",
    title: "Record the unboxing",
    type: "RECORDING",
    status: "PLANNED",
    startAt: at(2, 9),
    endAt: at(2, 12),
    notes: "Bring the ring light",
    project: unboxing,
  },
  {
    id: "ev-4",
    projectId: null,
    title: "Weekly livestream",
    type: "LIVESTREAM",
    status: "PLANNED",
    startAt: at(2, 18),
    endAt: at(2, 20),
    notes: null,
  },
  {
    id: "ev-5",
    projectId: "proj-1",
    title: "Edit the final cut",
    type: "EDITING",
    status: "PLANNED",
    startAt: at(3, 14),
    endAt: at(3, 17, 30),
    notes: null,
    project: unboxing,
  },
  {
    id: "ev-6",
    projectId: "proj-1",
    title: "Thumbnail options",
    type: "THUMBNAIL",
    status: "PLANNED",
    startAt: at(3, 15),
    endAt: at(3, 16),
    notes: null,
    project: unboxing,
  },
  {
    id: "ev-7",
    projectId: "proj-1",
    title: "Publish on YouTube",
    type: "PUBLISHING",
    status: "PLANNED",
    startAt: at(4, 17),
    endAt: at(4, 17, 30),
    notes: null,
    project: unboxing,
  },
];

export const PLANNER_PROJECTS: ContentProject[] = [
  {
    ...unboxing,
    publishAt: at(4, 17),
    notes: null,
    progress: { total: 6, done: 1 },
    nextEvent: {
      id: "ev-2",
      title: "Script the unboxing video",
      type: "SCRIPTING",
      status: "IN_PROGRESS",
      startAt: at(1, 10),
      endAt: at(1, 11, 30),
      customType: null,
    },
  },
  {
    id: "proj-2",
    title: "Cooking short: 15-minute pasta",
    platform: "youtube-short",
    publishAt: null,
    notes: null,
    progress: { total: 0, done: 0 },
    nextEvent: null,
  },
];

export const PLANNER_STATS: ContentPlannerStats = {
  sessions: 12,
  plannedMinutes: 1260,
  done: 5,
};
