import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import {
  REMINDER_BATCH_SIZE,
  REMINDER_GRACE_MINUTES,
  type ContentEventTypeValue,
} from "./content-planner.constants";

/** A session whose reminder is due, claimed by this process. */
export interface DueReminder {
  eventId: string;
  userId: string;
  title: string;
  type: ContentEventTypeValue;
  /** Name of the session's custom type, if it has one. */
  customTypeName: string | null;
  projectTitle: string | null;
  startAt: Date;
  endAt: Date;
  /** The session's "remind me" setting. */
  reminderMinutes: number;
}

/**
 * Finds sessions whose reminder moment has come. Each one is claimed with
 * a conditional update (`reminderSentAt IS NULL`), so when several API
 * instances poll at the same time only one of them notifies the user.
 */
@Injectable()
export class ContentPlannerReminderService {
  private logger = new Logger("ContentPlannerReminderService");

  async claimDueReminders(
    now = new Date(),
    limit: number = REMINDER_BATCH_SIZE,
  ): Promise<DueReminder[]> {
    const due = await prisma.contentEvent.findMany({
      where: {
        remindAt: { lte: now },
        reminderSentAt: null,
        status: "PLANNED",
        // Long-started sessions (e.g. while the server was down) are skipped.
        startAt: {
          gt: new Date(now.getTime() - REMINDER_GRACE_MINUTES * 60_000),
        },
      },
      orderBy: { remindAt: "asc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        title: true,
        type: true,
        startAt: true,
        endAt: true,
        reminderMinutes: true,
        customType: { select: { name: true } },
        project: { select: { title: true } },
      },
    });

    const claimed: DueReminder[] = [];
    for (const event of due) {
      const { count } = await prisma.contentEvent.updateMany({
        where: { id: event.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (count !== 1) continue; // another instance got it first
      claimed.push({
        eventId: event.id,
        userId: event.userId,
        title: event.title,
        type: event.type,
        customTypeName: event.customType?.name ?? null,
        projectTitle: event.project?.title ?? null,
        startAt: event.startAt,
        endAt: event.endAt,
        reminderMinutes: event.reminderMinutes ?? 0,
      });
    }
    if (claimed.length > 0) {
      this.logger.info("Session reminders due", { count: claimed.length });
    }
    return claimed;
  }

  /**
   * Fills `remindAt` for upcoming sessions that lack it — rows that existed
   * before reminders when the schema is applied with `prisma db push`
   * (the SQL migration backfills them itself). Safe to run on every start.
   */
  async backfillRemindAt(): Promise<number> {
    return prisma.$executeRawUnsafe(
      `UPDATE "ContentEvent"
         SET "remindAt" = "startAt" - ("reminderMinutes" * INTERVAL '1 minute')
       WHERE "remindAt" IS NULL
         AND "reminderMinutes" IS NOT NULL
         AND "reminderSentAt" IS NULL
         AND "startAt" > NOW()`,
    );
  }
}
