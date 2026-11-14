import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import {
  CREDIT_STATE_BALANCE,
  type CreditState,
} from "@creator-hub/shared-types";
import {
  CreateCreditEmailTriggerDto,
  UpdateCreditEmailTriggerDto,
} from "./dto/credit-email-trigger.dto";

/** Empty optional strings are stored as NULL. */
function optional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() ? value.trim() : null;
}

/** Admin CRUD for the email sent when a user enters a credit state. */
@Injectable()
export class CreditEmailTriggerService {
  async findAll() {
    return prisma.creditEmailTrigger.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string) {
    const trigger = await prisma.creditEmailTrigger.findUnique({
      where: { id },
    });
    if (!trigger) throw new NotFoundException("Credit email not found");
    return trigger;
  }

  async create(dto: CreateCreditEmailTriggerDto) {
    const existing = await prisma.creditEmailTrigger.findUnique({
      where: { state: dto.state },
    });
    if (existing) {
      throw new BadRequestException(
        `An email for ${CREDIT_STATE_BALANCE[dto.state as CreditState]} credits already exists`,
      );
    }

    return prisma.creditEmailTrigger.create({
      data: {
        state: dto.state,
        subject: dto.subject.trim(),
        heading: dto.heading.trim(),
        body: dto.body.trim(),
        ctaLabel: optional(dto.ctaLabel) ?? null,
        ctaUrl: optional(dto.ctaUrl) ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCreditEmailTriggerDto) {
    await this.findById(id);
    return prisma.creditEmailTrigger.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined && { subject: dto.subject.trim() }),
        ...(dto.heading !== undefined && { heading: dto.heading.trim() }),
        ...(dto.body !== undefined && { body: dto.body.trim() }),
        ...(dto.ctaLabel !== undefined && { ctaLabel: optional(dto.ctaLabel) }),
        ...(dto.ctaUrl !== undefined && { ctaUrl: optional(dto.ctaUrl) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return prisma.creditEmailTrigger.delete({ where: { id } });
  }

  async findLogs(limit: number) {
    return prisma.creditEmailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        userId: true,
        state: true,
        credits: true,
        email: true,
        subject: true,
        status: true,
        error: true,
        isTest: true,
        createdAt: true,
      },
    });
  }
}
