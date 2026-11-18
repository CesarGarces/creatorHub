import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import {
  voiceAllowanceFrom,
  voiceUsagePeriodKey,
  type FreeTierPeriod,
  type VoiceAllowance,
} from "@creator-hub/shared-types";
import { VoiceSettingsService } from "./voice-settings.service";

const PERIODS: FreeTierPeriod[] = ["monthly", "lifetime"];

/**
 * The Free plan's minutes with Robotina (Admin → Voice): how much voice
 * time — the user's (STT) plus hers (TTS) — a Free user has left.
 *
 * Seconds are counted for every Free user (so a limit set mid-month counts
 * what was already used), both in the UTC month ("2026-11") and in total
 * ("all"); the admin's period picks which one is checked. Paid plans are
 * never limited (nor counted). Reading never fails: if the usage can't be
 * read the user is not blocked.
 */
@Injectable()
export class VoiceAllowanceService {
  private readonly logger = new Logger("VoiceAllowanceService");

  constructor(private readonly settings: VoiceSettingsService) {}

  async get(userId: string, now = new Date()): Promise<VoiceAllowance> {
    const { freeTier } = await this.settings.get();
    const isFree = await this.isFreePlan(userId);
    if (!isFree || freeTier.minutes === null) {
      return voiceAllowanceFrom(freeTier, 0, isFree, now);
    }
    let used = 0;
    try {
      const row = await prisma.voiceUsage.findUnique({
        where: {
          userId_period: {
            userId,
            period: voiceUsagePeriodKey(freeTier.period, now),
          },
        },
        select: { seconds: true },
      });
      used = row?.seconds ?? 0;
    } catch (error) {
      this.logger.warn("Voice usage unavailable", {
        userId,
        error: (error as Error).message,
      });
    }
    return voiceAllowanceFrom(freeTier, used, true, now);
  }

  /**
   * Adds `durationMs` of voice with Robotina to a Free user's usage (every
   * started second). Paid plans are not counted.
   */
  async record(userId: string, durationMs: number, now = new Date()) {
    const seconds = Math.ceil(durationMs / 1000);
    if (seconds <= 0 || !(await this.isFreePlan(userId))) return;
    try {
      await Promise.all(
        PERIODS.map((period) => {
          const key = voiceUsagePeriodKey(period, now);
          return prisma.voiceUsage.upsert({
            where: { userId_period: { userId, period: key } },
            create: { userId, period: key, seconds },
            update: { seconds: { increment: seconds } },
          });
        }),
      );
    } catch (error) {
      this.logger.error("Could not record voice usage", {
        userId,
        seconds,
        error: (error as Error).message,
      });
    }
  }

  private async isFreePlan(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      return user?.plan === "FREE";
    } catch {
      return false;
    }
  }
}
