import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  Prisma,
  type ContentEvent,
  type ContentProject,
} from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { DEFAULT_REMINDER_MINUTES, LIMITS } from "./content-planner.constants";
import { findOverlaps, type TimeSlot } from "./overlaps";
import type {
  CreateContentEventDto,
  ListContentEventsQueryDto,
  ProjectEventInputDto,
  UpdateContentEventDto,
} from "./dto/content-event.dto";
import type {
  CreateContentProjectDto,
  UpdateContentProjectDto,
} from "./dto/content-project.dto";
import type {
  CreateCustomPlatformDto,
  CreateCustomTypeDto,
} from "./dto/custom-type.dto";
import type { ProductionStepDto } from "./dto/production-step.dto";

const PROJECT_SUMMARY = { select: { id: true, title: true, platform: true } };
const CUSTOM_TYPE_SUMMARY = {
  select: { id: true, name: true, color: true, icon: true },
};
const CUSTOM_PLATFORM_SUMMARY = { select: { id: true, name: true } };
const STEP_SELECT = {
  id: true,
  baseType: true,
  name: true,
  color: true,
  icon: true,
  durationMinutes: true,
  enabled: true,
  isPublish: true,
} as const;
/** Relations returned with every session. */
const EVENT_INCLUDE = {
  project: PROJECT_SUMMARY,
  customType: CUSTOM_TYPE_SUMMARY,
};

/** Totals over every session in the user's calendar (cancelled excluded). */
export interface ContentPlannerStats {
  sessions: number;
  /** Sum of the sessions' durations. */
  plannedMinutes: number;
  done: number;
}

/** A session as returned by the API, with its project and custom type. */
export type ContentEventRecord = ContentEvent & {
  project: { id: string; title: string; platform: string | null } | null;
  customType: { id: string; name: string; color: string; icon: string } | null;
};

export interface EventMutationResult {
  event: ContentEventRecord;
  conflicts: ContentEventConflict[];
}

export interface ProjectCreationResult {
  project: ContentProject & {
    customPlatform: { id: string; name: string } | null;
    events: ContentEvent[];
  };
  conflicts: ContentEventConflict[];
}

/** Minimal view of an overlapping session, returned as a non-blocking warning. */
export interface ContentEventConflict {
  id: string;
  title: string;
  type: string;
  startAt: Date;
  endAt: Date;
}

/** Trims and collapses inner whitespace ("  Sponsor   call " → "Sponsor call"). */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string })?.code === "P2002";

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new BadRequestException("Title is required");
  return trimmed;
}

/** Optional text: trimmed, and empty strings stored as null. */
function cleanNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

function toDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date`);
  }
  return date;
}

/**
 * Reminder columns for a session starting at `startAt`. A new schedule
 * always clears `reminderSentAt`, so a rescheduled session is reminded again.
 */
export function reminderFields(startAt: Date, minutes: number | null) {
  return {
    reminderMinutes: minutes,
    remindAt:
      minutes === null ? null : new Date(startAt.getTime() - minutes * 60_000),
    reminderSentAt: null,
  };
}

/** Prisma data for a session's suggested tool (null clears it). */
function toolActionData(
  action:
    | { toolId: string; intention: string; prompt: string }
    | null
    | undefined,
) {
  if (action === undefined) return {};
  return {
    toolAction: action
      ? {
          toolId: action.toolId,
          intention: action.intention.trim(),
          prompt: action.prompt.trim(),
        }
      : Prisma.DbNull,
  };
}

function assertValidSlot(startAt: Date, endAt: Date): void {
  if (endAt <= startAt) {
    throw new BadRequestException("The session must end after it starts");
  }
  if (endAt.getTime() - startAt.getTime() > LIMITS.maxEventDurationMs) {
    throw new BadRequestException("A session can't be longer than 24 hours");
  }
}

@Injectable()
export class ContentPlannerService {
  private logger = new Logger("ContentPlannerService");

  // ─── Sessions (calendar events) ────────────────────────────────────────

  async listEvents(
    userId: string,
    query: ListContentEventsQueryDto,
  ): Promise<ContentEventRecord[]> {
    const from = toDate(query.from, "from");
    const to = toDate(query.to, "to");
    if (to <= from) {
      throw new BadRequestException("`to` must be after `from`");
    }
    if (to.getTime() - from.getTime() > LIMITS.maxRangeMs) {
      throw new BadRequestException("The requested range is too large");
    }

    return prisma.contentEvent.findMany({
      where: {
        userId,
        // Anything that is at least partially inside the window.
        startAt: { lt: to },
        endAt: { gt: from },
        ...(query.projectId ? { projectId: query.projectId } : {}),
      },
      orderBy: { startAt: "asc" },
      include: EVENT_INCLUDE,
    });
  }

  /** One session of the user (null when missing or someone else's). */
  async getEvent(
    userId: string,
    eventId: string,
  ): Promise<ContentEventRecord | null> {
    return prisma.contentEvent.findFirst({
      where: { id: eventId, userId },
      include: EVENT_INCLUDE,
    });
  }

  async createEvent(
    userId: string,
    dto: CreateContentEventDto,
  ): Promise<EventMutationResult> {
    const startAt = toDate(dto.startAt, "startAt");
    const endAt = toDate(dto.endAt, "endAt");
    assertValidSlot(startAt, endAt);
    if (dto.projectId) await this.assertProjectOwned(userId, dto.projectId);
    if (dto.customTypeId) {
      await this.assertCustomTypeOwned(userId, dto.customTypeId);
    }

    const event = await prisma.contentEvent.create({
      data: {
        userId,
        projectId: dto.projectId ?? null,
        customTypeId: dto.customTypeId ?? null,
        title: cleanTitle(dto.title),
        // Custom-typed sessions are stored as OTHER.
        type: dto.customTypeId ? "OTHER" : dto.type,
        status: dto.status ?? "PLANNED",
        startAt,
        endAt,
        notes: cleanNotes(dto.notes),
        ...reminderFields(
          startAt,
          dto.reminderMinutes === undefined
            ? DEFAULT_REMINDER_MINUTES
            : dto.reminderMinutes,
        ),
        ...toolActionData(dto.toolAction),
      },
      include: EVENT_INCLUDE,
    });

    this.logger.info("Content event created", { userId, eventId: event.id });
    const conflicts = await this.findConflicts(userId, [event]);
    return { event, conflicts };
  }

  async updateEvent(
    userId: string,
    eventId: string,
    dto: UpdateContentEventDto,
  ): Promise<EventMutationResult> {
    const current = await prisma.contentEvent.findFirst({
      where: { id: eventId, userId },
    });
    if (!current) throw new NotFoundException("Session not found");

    const startAt = dto.startAt
      ? toDate(dto.startAt, "startAt")
      : current.startAt;
    const endAt = dto.endAt ? toDate(dto.endAt, "endAt") : current.endAt;
    assertValidSlot(startAt, endAt);
    if (dto.projectId) await this.assertProjectOwned(userId, dto.projectId);
    const typeData = await this.resolveTypeUpdate(userId, dto);

    // Re-arm the reminder only when its moment actually changes (moving the
    // session or changing the setting — not resizing its end).
    const minutes =
      dto.reminderMinutes !== undefined
        ? dto.reminderMinutes
        : current.reminderMinutes;
    const reminder = reminderFields(startAt, minutes);
    const reminderChanged =
      minutes !== current.reminderMinutes ||
      reminder.remindAt?.getTime() !== current.remindAt?.getTime();

    const event = await prisma.contentEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined ? { title: cleanTitle(dto.title) } : {}),
        ...typeData,
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: cleanNotes(dto.notes) } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.toolAction !== undefined ? toolActionData(dto.toolAction) : {}),
        ...(reminderChanged ? reminder : {}),
        startAt,
        endAt,
      },
      include: EVENT_INCLUDE,
    });

    const conflicts =
      event.status === "CANCELLED"
        ? []
        : await this.findConflicts(userId, [event]);
    return { event, conflicts };
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    // Scoped by userId: deleting someone else's session is a 404, not a 403,
    // so ids can't be probed.
    const { count } = await prisma.contentEvent.deleteMany({
      where: { id: eventId, userId },
    });
    if (count === 0) throw new NotFoundException("Session not found");
  }

  // ─── Video projects ────────────────────────────────────────────────────

  async listProjects(userId: string) {
    const projects = await prisma.contentProject.findMany({
      where: { userId },
      orderBy: [{ publishAt: { sort: "asc", nulls: "last" } }],
      take: LIMITS.maxProjectsListed,
      include: {
        customPlatform: CUSTOM_PLATFORM_SUMMARY,
        events: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            startAt: true,
            endAt: true,
            customType: CUSTOM_TYPE_SUMMARY,
          },
          orderBy: { startAt: "asc" },
        },
      },
    });

    const now = new Date();
    return projects.map(({ events, ...project }) => {
      const active = events.filter((e) => e.status !== "CANCELLED");
      return {
        ...project,
        progress: {
          total: active.length,
          done: active.filter((e) => e.status === "DONE").length,
        },
        nextEvent:
          active.find((e) => e.status !== "DONE" && e.endAt > now) ?? null,
      };
    });
  }

  /** One video project of the user with its session count, or null. */
  async getProject(userId: string, projectId: string) {
    return prisma.contentProject.findFirst({
      where: { id: projectId, userId },
      include: {
        customPlatform: CUSTOM_PLATFORM_SUMMARY,
        _count: { select: { events: true } },
      },
    });
  }

  async createProject(
    userId: string,
    dto: CreateContentProjectDto,
  ): Promise<ProjectCreationResult> {
    const inputs = dto.events ?? [];
    // Validate every session before touching the database.
    const events = inputs.map((e) => this.toEventData(userId, e));
    if (dto.customPlatformId) {
      await this.assertCustomPlatformOwned(userId, dto.customPlatformId);
    }
    if (dto.aiPlanId) {
      const aiPlan = await prisma.contentAiPlan.findFirst({
        where: { id: dto.aiPlanId, userId },
        select: { id: true },
      });
      if (!aiPlan) throw new NotFoundException("AI plan not found");
    }
    const typeIds = await this.resolveCustomTypeSpecs(
      userId,
      inputs.flatMap((e) => (e.customType ? [e.customType] : [])),
    );
    const eventData = events.map((data, i) => {
      const spec = inputs[i]?.customType;
      if (!spec) return data;
      const customTypeId = typeIds.get(normalizeName(spec.name).toLowerCase());
      return {
        ...data,
        type: "OTHER" as const,
        customTypeId: customTypeId ?? null,
      };
    });

    const project = await prisma.contentProject.create({
      data: {
        userId,
        title: cleanTitle(dto.title),
        platform: dto.customPlatformId ? null : (dto.platform ?? null),
        customPlatformId: dto.customPlatformId ?? null,
        publishAt: dto.publishAt ? toDate(dto.publishAt, "publishAt") : null,
        notes: cleanNotes(dto.notes),
        ...(eventData.length > 0 ? { events: { create: eventData } } : {}),
      },
      include: {
        customPlatform: CUSTOM_PLATFORM_SUMMARY,
        events: { orderBy: { startAt: "asc" } },
      },
    });

    if (dto.aiPlanId) {
      await prisma.contentAiPlan.update({
        where: { id: dto.aiPlanId },
        data: { status: "APPLIED", projectId: project.id },
      });
    }

    this.logger.info("Content project created", {
      userId,
      projectId: project.id,
      events: project.events.length,
      aiPlanId: dto.aiPlanId,
    });
    const conflicts = await this.findConflicts(userId, project.events);
    return { project, conflicts };
  }

  async updateProject(
    userId: string,
    projectId: string,
    dto: UpdateContentProjectDto,
  ) {
    await this.assertProjectOwned(userId, projectId);
    if (dto.customPlatformId) {
      await this.assertCustomPlatformOwned(userId, dto.customPlatformId);
    }

    return prisma.contentProject.update({
      where: { id: projectId },
      data: {
        ...(dto.title !== undefined ? { title: cleanTitle(dto.title) } : {}),
        ...(dto.platform !== undefined ? { platform: dto.platform } : {}),
        // A custom platform replaces the built-in one.
        ...(dto.customPlatformId
          ? { customPlatformId: dto.customPlatformId, platform: null }
          : dto.customPlatformId === null
            ? { customPlatformId: null }
            : {}),
        ...(dto.publishAt !== undefined
          ? {
              publishAt: dto.publishAt
                ? toDate(dto.publishAt, "publishAt")
                : null,
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: cleanNotes(dto.notes) } : {}),
      },
      include: { customPlatform: CUSTOM_PLATFORM_SUMMARY },
    });
  }

  /** Deletes the project and, through the FK cascade, all of its sessions. */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    const { count } = await prisma.contentProject.deleteMany({
      where: { id: projectId, userId },
    });
    if (count === 0) throw new NotFoundException("Project not found");
    this.logger.info("Content project deleted", { userId, projectId });
  }

  // ─── Summary ───────────────────────────────────────────────────────────

  /**
   * Totals over every session the user has registered (not only the period
   * on screen). Cancelled sessions don't count. Only the three columns needed
   * are read; durations are summed here because Prisma can't aggregate a
   * difference of two columns.
   */
  async getStats(userId: string): Promise<ContentPlannerStats> {
    const events = await prisma.contentEvent.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      select: { status: true, startAt: true, endAt: true },
    });

    let plannedMs = 0;
    let done = 0;
    for (const e of events) {
      plannedMs += e.endAt.getTime() - e.startAt.getTime();
      if (e.status === "DONE") done++;
    }
    return {
      sessions: events.length,
      plannedMinutes: Math.round(plannedMs / 60_000),
      done,
    };
  }

  // ─── Custom types ──────────────────────────────────────────────────────

  async listCustomTypes(userId: string) {
    return prisma.contentCustomType.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: CUSTOM_TYPE_SUMMARY.select,
    });
  }

  async createCustomType(userId: string, dto: CreateCustomTypeDto) {
    const name = normalizeName(dto.name);
    if (!name) throw new BadRequestException("Type name is required");

    const [count, sameName] = await Promise.all([
      prisma.contentCustomType.count({ where: { userId } }),
      prisma.contentCustomType.findFirst({
        where: { userId, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      }),
    ]);
    if (sameName) {
      throw new ConflictException("A type with this name already exists");
    }
    if (count >= LIMITS.maxCustomTypesPerUser) {
      throw new BadRequestException(
        `You can have up to ${LIMITS.maxCustomTypesPerUser} custom types`,
      );
    }

    try {
      return await prisma.contentCustomType.create({
        data: { userId, name, color: dto.color, icon: dto.icon ?? "tag" },
        select: CUSTOM_TYPE_SUMMARY.select,
      });
    } catch (error) {
      // Two identical requests racing past the check above.
      if (isUniqueViolation(error)) {
        throw new ConflictException("A type with this name already exists");
      }
      throw error;
    }
  }

  /** Sessions using the type keep existing and fall back to OTHER (FK SetNull). */
  async deleteCustomType(userId: string, typeId: string): Promise<void> {
    const { count } = await prisma.contentCustomType.deleteMany({
      where: { id: typeId, userId },
    });
    if (count === 0) throw new NotFoundException("Type not found");
  }

  // ─── Custom platforms ──────────────────────────────────────────────────

  async listCustomPlatforms(userId: string) {
    return prisma.contentCustomPlatform.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: CUSTOM_PLATFORM_SUMMARY.select,
    });
  }

  async createCustomPlatform(userId: string, dto: CreateCustomPlatformDto) {
    const name = normalizeName(dto.name);
    if (!name) throw new BadRequestException("Platform name is required");

    const [count, sameName] = await Promise.all([
      prisma.contentCustomPlatform.count({ where: { userId } }),
      prisma.contentCustomPlatform.findFirst({
        where: { userId, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      }),
    ]);
    if (sameName) {
      throw new ConflictException("A platform with this name already exists");
    }
    if (count >= LIMITS.maxCustomPlatformsPerUser) {
      throw new BadRequestException(
        `You can have up to ${LIMITS.maxCustomPlatformsPerUser} custom platforms`,
      );
    }
    try {
      return await prisma.contentCustomPlatform.create({
        data: { userId, name },
        select: CUSTOM_PLATFORM_SUMMARY.select,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A platform with this name already exists");
      }
      throw error;
    }
  }

  /** Projects using it keep existing, without a platform (FK SetNull). */
  async deleteCustomPlatform(userId: string, platformId: string) {
    const { count } = await prisma.contentCustomPlatform.deleteMany({
      where: { id: platformId, userId },
    });
    if (count === 0) throw new NotFoundException("Platform not found");
  }

  // ─── Production steps template ─────────────────────────────────────────

  /** The saved template, in order; empty = use the built-in steps. */
  async getProductionSteps(userId: string) {
    return prisma.contentProductionStep.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      select: STEP_SELECT,
    });
  }

  /** Replaces the whole template (the order of `steps` is kept). */
  async saveProductionSteps(userId: string, steps: ProductionStepDto[]) {
    if (steps.filter((s) => s.isPublish).length > 1) {
      throw new BadRequestException("Only one step can be the publishing step");
    }
    const data = steps.map((step, position) => {
      const name = step.name ? normalizeName(step.name) : null;
      if (!step.baseType && !name) {
        throw new BadRequestException("Every added step needs a name");
      }
      return {
        userId,
        position,
        baseType: step.baseType ?? null,
        name: name || null,
        color: step.color ?? null,
        icon: step.icon ?? null,
        durationMinutes: step.durationMinutes,
        enabled: step.enabled,
        isPublish: step.isPublish,
      };
    });

    await prisma.$transaction([
      prisma.contentProductionStep.deleteMany({ where: { userId } }),
      prisma.contentProductionStep.createMany({ data }),
    ]);
    return this.getProductionSteps(userId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Custom types for customised production steps, by lower-case name.
   * Reuses the user's type with the same name (updating its look) or
   * creates it, within the per-user limit.
   */
  private async resolveCustomTypeSpecs(
    userId: string,
    specs: CreateCustomTypeDto[],
  ): Promise<Map<string, string>> {
    const wanted = new Map<
      string,
      { name: string; color: string; icon: string }
    >();
    for (const spec of specs) {
      const name = normalizeName(spec.name);
      if (!name) throw new BadRequestException("Type name is required");
      wanted.set(name.toLowerCase(), {
        name,
        color: spec.color,
        icon: spec.icon ?? "tag",
      });
    }
    const ids = new Map<string, string>();
    if (wanted.size === 0) return ids;

    const existing = await prisma.contentCustomType.findMany({
      where: { userId },
      select: CUSTOM_TYPE_SUMMARY.select,
    });
    const missing: { name: string; color: string; icon: string }[] = [];
    for (const [key, spec] of wanted) {
      const found = existing.find((t) => t.name.toLowerCase() === key);
      if (!found) {
        missing.push(spec);
        continue;
      }
      ids.set(key, found.id);
      if (found.color !== spec.color || found.icon !== spec.icon) {
        await prisma.contentCustomType.update({
          where: { id: found.id },
          data: { color: spec.color, icon: spec.icon },
        });
      }
    }

    if (existing.length + missing.length > LIMITS.maxCustomTypesPerUser) {
      throw new BadRequestException(
        `You can have up to ${LIMITS.maxCustomTypesPerUser} custom types`,
      );
    }
    for (const spec of missing) {
      try {
        const created = await prisma.contentCustomType.create({
          data: { userId, ...spec },
          select: { id: true },
        });
        ids.set(spec.name.toLowerCase(), created.id);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Created concurrently with the same name: use that one.
        const again = await prisma.contentCustomType.findFirst({
          where: { userId, name: spec.name },
          select: { id: true },
        });
        if (again) ids.set(spec.name.toLowerCase(), again.id);
      }
    }
    return ids;
  }

  private async assertCustomPlatformOwned(userId: string, platformId: string) {
    const platform = await prisma.contentCustomPlatform.findFirst({
      where: { id: platformId, userId },
      select: { id: true },
    });
    if (!platform) throw new NotFoundException("Platform not found");
  }

  /**
   * Type fields for an update. A custom type forces `type` to OTHER;
   * choosing a built-in type other than OTHER drops the custom type.
   */
  private async resolveTypeUpdate(userId: string, dto: UpdateContentEventDto) {
    if (dto.customTypeId) {
      await this.assertCustomTypeOwned(userId, dto.customTypeId);
      return { type: "OTHER" as const, customTypeId: dto.customTypeId };
    }
    if (dto.customTypeId === null) {
      return {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        customTypeId: null,
      };
    }
    if (dto.type === undefined) return {};
    return dto.type === "OTHER"
      ? { type: dto.type }
      : { type: dto.type, customTypeId: null };
  }

  private async assertCustomTypeOwned(userId: string, typeId: string) {
    const type = await prisma.contentCustomType.findFirst({
      where: { id: typeId, userId },
      select: { id: true },
    });
    if (!type) throw new NotFoundException("Type not found");
  }

  private toEventData(userId: string, input: ProjectEventInputDto) {
    const startAt = toDate(input.startAt, "startAt");
    const endAt = toDate(input.endAt, "endAt");
    assertValidSlot(startAt, endAt);
    return {
      userId,
      title: cleanTitle(input.title),
      type: input.type,
      status: input.status ?? "PLANNED",
      startAt,
      endAt,
      notes: cleanNotes(input.notes),
      ...reminderFields(
        startAt,
        input.reminderMinutes === undefined
          ? DEFAULT_REMINDER_MINUTES
          : input.reminderMinutes,
      ),
      ...toolActionData(input.toolAction),
    };
  }

  private async assertProjectOwned(userId: string, projectId: string) {
    const project = await prisma.contentProject.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException("Project not found");
  }

  /**
   * Other active sessions of the user that overlap the given ones.
   * Overlaps are allowed (creators do multitask) — they are only reported
   * so the UI can warn about double-booking.
   */
  private async findConflicts(
    userId: string,
    slots: (TimeSlot & { id: string })[],
  ): Promise<ContentEventConflict[]> {
    if (slots.length === 0) return [];
    const from = new Date(Math.min(...slots.map((s) => s.startAt.getTime())));
    const to = new Date(Math.max(...slots.map((s) => s.endAt.getTime())));

    const nearby = await prisma.contentEvent.findMany({
      where: {
        userId,
        id: { notIn: slots.map((s) => s.id) },
        status: { not: "CANCELLED" },
        startAt: { lt: to },
        endAt: { gt: from },
      },
      select: { id: true, title: true, type: true, startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
    });

    return findOverlaps(slots, nearby).slice(0, LIMITS.maxConflictsReported);
  }
}
