import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { NotificationType } from "@creator-hub/database";
import {
  ContentPlannerReminderService,
  type DueReminder,
} from "@creator-hub/content-planner-backend";
import { NotificationService } from "../notification/notification.service";
import { AppGateway } from "../websocket/websocket.gateway";

/** How often due reminders are checked (default 30 s). */
const DEFAULT_INTERVAL_MS = 30_000;

/** Stored with the notification so the app can show it in the user's language and time zone. */
export interface SessionReminderData {
  kind: "session-reminder";
  eventId: string;
  eventTitle: string;
  startAt: string;
  endAt: string;
  reminderMinutes: number;
  type: string;
  customTypeName: string | null;
  projectTitle: string | null;
}

/**
 * Turns Content Planner reminders into notifications: every interval it
 * claims the sessions whose reminder moment has come, stores a
 * SESSION_REMINDER notification and pushes it over the WebSocket
 * ("notification:new"), which shows a toast and updates the bell.
 *
 * Disable with CONTENT_PLANNER_REMINDERS=off; tune with
 * CONTENT_PLANNER_REMINDER_INTERVAL_MS.
 */
@Injectable()
export class ContentPlannerRemindersService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContentPlannerRemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(ContentPlannerReminderService)
    private readonly reminders: ContentPlannerReminderService,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
    @Inject(AppGateway)
    private readonly gateway: AppGateway,
  ) {}

  onModuleInit() {
    if (process.env.CONTENT_PLANNER_REMINDERS === "off") {
      this.logger.log("Session reminders disabled");
      return;
    }
    const interval =
      Number(process.env.CONTENT_PLANNER_REMINDER_INTERVAL_MS) ||
      DEFAULT_INTERVAL_MS;
    void this.reminders
      .backfillRemindAt()
      .catch((error) =>
        this.logger.warn(`Reminder backfill failed: ${String(error)}`),
      );
    this.timer = setInterval(() => void this.tick(), interval);
    // Never keep the process alive just for reminders.
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One polling round. Overlapping rounds are skipped. */
  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const due = await this.reminders.claimDueReminders(now);
      for (const reminder of due) {
        try {
          await this.notify(reminder, now);
          sent++;
        } catch (error) {
          // One failure must not block the other users' reminders.
          this.logger.error(
            `Reminder for session ${reminder.eventId} failed: ${String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Reminder round failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
    return sent;
  }

  private async notify(reminder: DueReminder, now: Date) {
    const data: SessionReminderData = {
      kind: "session-reminder",
      eventId: reminder.eventId,
      eventTitle: reminder.title,
      startAt: reminder.startAt.toISOString(),
      endAt: reminder.endAt.toISOString(),
      reminderMinutes: reminder.reminderMinutes,
      type: reminder.type,
      customTypeName: reminder.customTypeName,
      projectTitle: reminder.projectTitle,
    };
    const notification = await this.notifications.create({
      userId: reminder.userId,
      type: NotificationType.SESSION_REMINDER,
      // English fallback; the web app renders `data` in the user's
      // language and local time (the server doesn't know the time zone).
      title: "Upcoming session",
      body: reminderText(reminder.title, reminder.startAt, now),
      data: data as unknown as Record<string, unknown>,
    });
    this.gateway.emitToUser(reminder.userId, "notification:new", notification);
  }
}

/** `"Record intro" starts in 15 minutes` / `"Record intro" is starting now`. */
export function reminderText(title: string, startAt: Date, now: Date): string {
  const minutes = Math.round((startAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return `"${title}" is starting now`;
  if (minutes < 60) {
    return `"${title}" starts in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `"${title}" starts in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(hours / 24);
  return `"${title}" starts in ${days} day${days === 1 ? "" : "s"}`;
}
